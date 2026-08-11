import { describe, expect, it, vi } from 'vitest';
import {
  ConsentSigningError,
  requestOTP,
  sign,
  verifyOTP,
} from '../../services/consent-signing-service';

const ids = {
  consent: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
  version: '33333333-3333-4333-8333-333333333333',
};

function dbMock() {
  const state = {
    secure_otps: [] as any[],
    consent_documents: [{ id: ids.consent, current_version_id: ids.version, status: 'awaiting_client_signature' }],
    consent_document_versions: [{ id: ids.version, consent_id: ids.consent, content_html: '<p>Consent</p>', content_hash: 'hash' }],
    consent_signatures: [] as any[],
  };
  return { state, from: vi.fn((table: keyof typeof state) => query(state, table)) } as any;
}

function query(state: any, table: string) {
  const filters: Array<(row: any) => boolean> = [];
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((field: string, value: unknown) => {
      filters.push((row) => row[field] === value);
      return builder;
    }),
    maybeSingle: vi.fn(async () => ({ data: state[table].find((row: any) => filters.every((fn) => fn(row))) ?? null, error: null })),
    single: vi.fn(async () => ({ data: builder._last, error: builder._last ? null : { message: 'missing' } })),
    insert: vi.fn((payload: any) => {
      builder._last = { id: `${table}-${state[table].length + 1}`, created_at: 'now', ...payload };
      state[table].push(builder._last);
      return builder;
    }),
    update: vi.fn((payload: any) => {
      const row = state[table].find((item: any) => filters.every((fn) => fn(item)));
      if (row) Object.assign(row, payload);
      builder._last = row;
      return builder;
    }),
  };
  return builder;
}

const fingerprint = { screenResolution: '1920x1080', timezone: 'Europe/Rome', canvasHash: 'abc', language: 'it-IT', platform: 'MacIntel' };

describe('consent-signing-service', () => {
  it('stores HMAC OTP and verifies it once', async () => {
    const db = dbMock();
    const result = await requestOTP(db, {
      consentId: ids.consent,
      userId: ids.user,
      email: 'client@example.com',
      requestIp: '127.0.0.1',
      requestUserAgent: 'vitest',
      requestDeviceFingerprint: fingerprint,
    }, { sendConsentOTPEmail: vi.fn() } as any, { codeFactory: () => '123456', referenceFactory: () => 'ref-1', saltFactory: () => 'salt' });

    expect(result).toEqual({ reference: 'ref-1' });
    expect(db.state.secure_otps[0].code_hash).not.toBe('123456');
    await expect(verifyOTP(db, { reference: 'ref-1', code: '123456', verifyIp: '127.0.0.1', verifyUserAgent: 'vitest' }))
      .resolves.toMatchObject({ otpId: expect.any(String) });
  });

  it('blocks OTP after three invalid attempts', async () => {
    const db = dbMock();
    await requestOTP(db, {
      consentId: ids.consent,
      userId: ids.user,
      email: 'client@example.com',
      requestIp: '127.0.0.1',
      requestUserAgent: 'vitest',
      requestDeviceFingerprint: fingerprint,
    }, { sendConsentOTPEmail: vi.fn() } as any, { codeFactory: () => '123456', referenceFactory: () => 'ref-1', saltFactory: () => 'salt' });

    await expect(verifyOTP(db, { reference: 'ref-1', code: '000000', verifyIp: '127.0.0.1', verifyUserAgent: 'vitest' })).rejects.toBeInstanceOf(ConsentSigningError);
    await expect(verifyOTP(db, { reference: 'ref-1', code: '000000', verifyIp: '127.0.0.1', verifyUserAgent: 'vitest' })).rejects.toBeInstanceOf(ConsentSigningError);
    await expect(verifyOTP(db, { reference: 'ref-1', code: '000000', verifyIp: '127.0.0.1', verifyUserAgent: 'vitest' })).rejects.toMatchObject({ code: 'OTP_BLOCKED' });
  });

  it('rejects oversized graphometric signatures', async () => {
    const large = `data:image/png;base64,${'a'.repeat(501 * 1024)}`;
    await expect(sign(dbMock(), {
      consentId: ids.consent,
      signerId: ids.user,
      signerRole: 'client',
      signerName: 'Ada Rossi',
      method: 'GRAPHOMETRIC',
      signatureImageData: large,
      signedAt: '2026-06-25T12:00:00.000Z',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      deviceFingerprint: fingerprint,
    }, { advanceFSM: vi.fn() } as any)).rejects.toMatchObject({ code: 'SIGNATURE_TOO_LARGE', statusCode: 413 });
  });
});
