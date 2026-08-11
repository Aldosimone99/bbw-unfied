import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';
import type { DeviceFingerprint } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import type { EmailService } from './email-service';
import { normalizePngSignatureDataUrl } from './signature-service';

export class ConsentSigningError extends Error {
  constructor(public code: string, public statusCode: number, message = code) {
    super(message);
  }
}

function otpSecret(): string {
  return process.env.OTP_SECRET ?? 'dev-consent-otp-secret';
}

function hmacCode(code: string, salt: string): string {
  return createHmac('sha256', otpSecret()).update(`${code}${salt}`).digest('hex');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function requestOTP(db: SupabaseLike, payload: {
  consentId: string;
  userId: string;
  email: string;
  requestIp: string;
  requestUserAgent: string;
  requestDeviceFingerprint: DeviceFingerprint;
}, emailService: EmailService, options: { codeFactory?: () => string; referenceFactory?: () => string; saltFactory?: () => string } = {}) {
  const code = options.codeFactory?.() ?? generateCode();
  const reference = options.referenceFactory?.() ?? randomUUID();
  const salt = options.saltFactory?.() ?? randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await db.from('secure_otps').insert({
    reference,
    consent_id: payload.consentId,
    user_id: payload.userId,
    email: payload.email,
    purpose: 'consent_signature',
    code_hash: hmacCode(code, salt),
    salt,
    expires_at: expiresAt,
    request_ip: payload.requestIp,
    request_user_agent: payload.requestUserAgent,
    request_device_fingerprint: payload.requestDeviceFingerprint,
  });
  if (error) throw new ConsentSigningError('OTP_CREATE_FAILED', 500);
  await emailService.sendConsentOTPEmail({ to: payload.email, code });
  return { reference };
}

export async function verifyOTP(db: SupabaseLike, payload: {
  reference: string;
  code: string;
  verifyIp: string;
  verifyUserAgent: string;
}) {
  const { data } = await db.from('secure_otps').select('*').eq('reference', payload.reference).maybeSingle();
  if (!data) throw new ConsentSigningError('OTP_NOT_FOUND', 404);
  const row = data as any;
  if (row.verified) throw new ConsentSigningError('OTP_ALREADY_USED', 409);
  if (row.blocked) throw new ConsentSigningError('OTP_BLOCKED', 429);
  if (new Date(row.expires_at).getTime() < Date.now()) throw new ConsentSigningError('OTP_EXPIRED', 410);
  const expected = hmacCode(payload.code, row.salt);
  if (expected !== row.code_hash) {
    const attempts = Number(row.attempts ?? 0) + 1;
    const blocked = attempts >= 3;
    await db.from('secure_otps').update({
      attempts,
      blocked,
      last_attempt_at: new Date().toISOString(),
    }).eq('reference', payload.reference);
    throw new ConsentSigningError(blocked ? 'OTP_BLOCKED' : 'OTP_INVALID', blocked ? 429 : 400);
  }
  const now = new Date().toISOString();
  await db.from('secure_otps').update({
    verified: true,
    verified_at: now,
    verify_ip: payload.verifyIp,
    verify_user_agent: payload.verifyUserAgent,
  }).eq('reference', payload.reference);
  return { otpId: row.id };
}

export async function sign(db: SupabaseLike, payload: {
  consentId: string;
  signerId: string;
  signerRole: 'doctor' | 'clinic' | 'client';
  signerName: string;
  signerEmail?: string;
  method: 'OTP_EMAIL' | 'GRAPHOMETRIC';
  otpReference?: string;
  otpCode?: string;
  signatureImageData?: string;
  signedAt: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: DeviceFingerprint;
  geolocation?: { latitude: number; longitude: number; accuracy: number };
}, consentDocumentService: { advanceFSM: Function }) {
  const { data: doc } = await db.from('consent_documents').select('*').eq('id', payload.consentId).maybeSingle();
  if (!doc) throw new ConsentSigningError('DOCUMENT_NOT_FOUND', 404);
  const allowed: Record<string, string> = {
    doctor: 'awaiting_doctor_signature',
    clinic: 'awaiting_clinic_signature',
    client: 'awaiting_client_signature',
  };
  if ((doc as any).status !== allowed[payload.signerRole]) throw new ConsentSigningError('SIGNATURE_WRONG_STATUS', 409);

  const { data: version } = await db.from('consent_document_versions').select('*').eq('id', (doc as any).current_version_id).maybeSingle();
  if (!version) throw new ConsentSigningError('VERSION_NOT_FOUND', 404);

  let normalizedSignature: string | null = null;
  let otpVerifiedAt: string | null = null;
  if (payload.method === 'OTP_EMAIL') {
    if (!payload.otpReference || !payload.otpCode) throw new ConsentSigningError('OTP_REQUIRED', 400);
    await verifyOTP(db, {
      reference: payload.otpReference,
      code: payload.otpCode,
      verifyIp: payload.ipAddress,
      verifyUserAgent: payload.userAgent,
    });
    const { data: otp } = await db.from('secure_otps').select('*').eq('reference', payload.otpReference).maybeSingle();
    if (!otp || (otp as any).user_id !== payload.signerId || (otp as any).consent_id !== payload.consentId) {
      throw new ConsentSigningError('OTP_SIGNER_MISMATCH', 403);
    }
    otpVerifiedAt = (otp as any).verified_at;
  } else {
    if (!payload.signatureImageData) throw new ConsentSigningError('SIGNATURE_REQUIRED', 400);
    normalizedSignature = normalizePngSignatureDataUrl(payload.signatureImageData);
    if (normalizedSignature.length > 500 * 1024) throw new ConsentSigningError('SIGNATURE_TOO_LARGE', 413);
  }

  const documentHash = sha256(String((version as any).content_html));
  const signatureHash = sha256(`${payload.signerId}${documentHash}${payload.signedAt}${payload.ipAddress}`);
  const { data, error } = await db.from('consent_signatures').insert({
    consent_id: payload.consentId,
    version_id: (version as any).id,
    signer_id: payload.signerId,
    signer_role: payload.signerRole,
    signer_name: payload.signerName,
    signer_email: payload.signerEmail ?? null,
    method: payload.method,
    signature_image_data: normalizedSignature,
    otp_reference: payload.otpReference ?? null,
    otp_verified_at: otpVerifiedAt,
    signed_at: payload.signedAt,
    ip_address: payload.ipAddress,
    user_agent: payload.userAgent,
    device_fingerprint: payload.deviceFingerprint,
    geolocation: payload.geolocation ?? null,
    document_hash: documentHash,
    signature_hash: signatureHash,
  }).select('*').single();
  if (error || !data) throw new ConsentSigningError('SIGNATURE_CREATE_FAILED', 500);

  await consentDocumentService.advanceFSM(db, payload.consentId, payload.signerRole, (data as any).id, payload.signerName, payload.signerRole);
  return data;
}
