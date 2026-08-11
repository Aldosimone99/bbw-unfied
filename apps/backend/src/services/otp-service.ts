import crypto, { randomInt } from 'node:crypto';
import type { OtpPurpose } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { createSupabaseServerClient } from '../db/supabase';
import { rateLimit } from './rate-limit-service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// ---------------------------------------------------------------------------
// Dev in-memory OTP store (no DB dependency in dev)
// ---------------------------------------------------------------------------

type OtpRecord = {
  reference: string;
  email: string;
  purpose: string;
  code: string;
  expiresAt: number;
  verifiedAt: number | null;
};

export const devStore = new Map<string, OtpRecord>();

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// ---------------------------------------------------------------------------
// Email stub (real implementation wired up separately)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function sendOtpEmail(_email: string, _code: string, _purpose: OtpPurpose): Promise<void> {
  // no-op stub
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

function getDb(injected?: SupabaseLike): SupabaseLike {
  return injected ?? createSupabaseServerClient();
}

// ---------------------------------------------------------------------------
// issueOtp
// ---------------------------------------------------------------------------

export async function issueOtp(
  params: { email: string; purpose: OtpPurpose; userId?: string },
  db?: SupabaseLike,
): Promise<{ reference: string; expiresAt: Date; code?: string }> {
  const code = generateCode();
  const reference = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  if (!isProduction()) {
    devStore.set(reference, {
      reference,
      email: params.email,
      purpose: params.purpose,
      code,
      expiresAt: expiresAt.getTime(),
      verifiedAt: null,
    });
    return { reference, expiresAt, code };
  }

  const client = getDb(db);
  const { error } = await client.from('otps').insert({
    reference,
    email: params.email,
    purpose: params.purpose,
    user_id: params.userId ?? null,
    code,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new AuthError(`OTP_INSERT_FAILED: ${error.message ?? error}`);
  }

  // Fire-and-forget — do not await
  void sendOtpEmail(params.email, code, params.purpose);

  const result: { reference: string; expiresAt: Date; code?: string } = { reference, expiresAt };

  if (!isProduction()) {
    result.code = code;
  }

  return result;
}

// ---------------------------------------------------------------------------
// validateOtp
// ---------------------------------------------------------------------------

export async function validateOtp(
  params: { code: string; reference?: string; email?: string; purpose: OtpPurpose },
  db?: SupabaseLike,
): Promise<void> {
  if (!isProduction()) {
    const record = params.reference
      ? devStore.get(params.reference)
      : [...devStore.values()].find((r) => r.email === params.email && r.purpose === params.purpose);
    if (!record) throw new AuthError('OTP_NOT_FOUND');
    if (Date.now() > record.expiresAt) {
      devStore.delete(record.reference);
      throw new AuthError('OTP_EXPIRED');
    }
    if (record.verifiedAt) throw new AuthError('OTP_ALREADY_VERIFIED');
    if (record.code !== params.code) throw new AuthError('OTP_INVALID');
    record.verifiedAt = Date.now();
    return;
  }

  const client = getDb(db);

  let query = client.from('otps').select('*').eq('purpose', params.purpose);

  if (params.reference) {
    query = query.eq('reference', params.reference);
  } else if (params.email) {
    query = query.eq('email', params.email);
  } else {
    throw new AuthError('OTP_LOOKUP_REQUIRES_REFERENCE_OR_EMAIL');
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    throw new AuthError('OTP_NOT_FOUND');
  }

  const now = Date.now();
  const expiresAt = new Date(data.expires_at).getTime();

  if (now > expiresAt) {
    throw new AuthError('OTP_EXPIRED');
  }

  if (data.code !== params.code) {
    throw new AuthError('OTP_INVALID');
  }

  if (data.verified_at) {
    throw new AuthError('OTP_ALREADY_VERIFIED');
  }

  // Mark as verified
  const { error: updateError } = await client
    .from('otps')
    .update({ verified_at: new Date().toISOString() })
    .eq('reference', data.reference);

  if (updateError) {
    throw new AuthError('OTP_VERIFY_FAILED');
  }
}

// ---------------------------------------------------------------------------
// resendOtp
// ---------------------------------------------------------------------------

export async function resendOtp(
  email: string,
  purpose: OtpPurpose,
  db?: SupabaseLike,
): Promise<{ reference: string; expiresAt: Date; code?: string }> {
  await rateLimit({
    key: `otp-resend:${email}`,
    limit: 3,
    window: 15 * 60 * 1000, // 15 min
  });

  if (!isProduction()) {
    return issueOtp({ email, purpose }, db);
  }

  const client = getDb(db);

  // Check for a valid (non-expired) existing OTP
  const { data } = await client
    .from('otps')
    .select('*')
    .eq('email', email)
    .eq('purpose', purpose)
    .maybeSingle();

  const now = Date.now();

  if (data && !data.verified_at && new Date(data.expires_at).getTime() > now) {
    // Deduplication — resend same OTP
    void sendOtpEmail(email, data.code, purpose);
    const result: { reference: string; expiresAt: Date; code?: string } = {
      reference: data.reference,
      expiresAt: new Date(data.expires_at),
    };
    if (!isProduction()) {
      result.code = data.code;
    }
    return result;
  }

  // No valid OTP found — issue a new one
  const { reference, expiresAt, code } = await issueOtp({ email, purpose }, client);
  return { reference, expiresAt, code };
}
