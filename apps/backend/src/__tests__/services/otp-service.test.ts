import { describe, expect, it, vi, beforeEach } from 'vitest';
import { issueOtp, validateOtp, resendOtp, AuthError } from '../../services/otp-service';

// ---------------------------------------------------------------------------
// Mock the rate-limit service so resendOtp tests don't need Redis
// ---------------------------------------------------------------------------
vi.mock('../../services/rate-limit-service', () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {
    constructor(message: string) { super(message); this.name = 'RateLimitError'; }
  },
  __clearLimiterCacheForTesting: vi.fn(),
}));

// ---------------------------------------------------------------------------
// In-memory OTP store used by the mock DB
// ---------------------------------------------------------------------------

type OtpRow = {
  reference: string;
  email: string;
  purpose: string;
  user_id: string | null;
  code: string;
  expires_at: string;
  verified_at?: string | null;
};

let store: OtpRow[] = [];

function makeDb() {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'otps') throw new Error(`unexpected table: ${table}`);
      return {
        insert: vi.fn((row: OtpRow) => {
          store.push(row);
          return Promise.resolve({ error: null });
        }),
        select: vi.fn(() => ({
          eq: function buildEq(this: { filters: Array<[string, unknown]> }, col: string, val: unknown) {
            const next: any = { ...this, filters: [...(this.filters ?? []), [col, val] as [string, unknown]] };
            next.eq = buildEq.bind(next);
            next.maybeSingle = maybeSingle.bind(next);
            return next;
          },
          maybeSingle: maybeSingle,
          filters: [] as Array<[string, unknown]>,
        })),
        update: vi.fn((row: Partial<OtpRow>) => ({
          eq: function buildEqUpd(this: { filters: Array<[string, unknown]> }, col: string, val: unknown) {
            const next: any = { ...this, filters: [...(this.filters ?? []), [col, val] as [string, unknown]] };
            next.eq = buildEqUpd.bind(next);
            store = store.map((r) =>
              (next.filters ?? []).every(([c, v]: [string, unknown]) => (r as Record<string, unknown>)[c] === v)
                ? { ...r, ...row }
                : r,
            );
            return Promise.resolve({ error: null });
          },
          filters: [] as Array<[string, unknown]>,
        })),
        delete: vi.fn(() => ({
          eq: function buildEqDel(this: { filters: Array<[string, unknown]> }, col: string, val: unknown) {
            const next: any = { ...this, filters: [...(this.filters ?? []), [col, val] as [string, unknown]] };
            next.eq = buildEqDel.bind(next);
            // Execute the delete synchronously when chained
            store = store.filter((row) => !next.filters.every(([c, v]: [string, unknown]) => (row as Record<string, unknown>)[c] === v));
            return next;
          },
          filters: [] as Array<[string, unknown]>,
        })),
      };
    }),
  } as any;
}

function maybeSingle(this: { filters: Array<[string, unknown]> }) {
  const found = store.find((row) =>
    (this.filters ?? []).every(([col, val]) => (row as Record<string, unknown>)[col] === val),
  );
  return Promise.resolve({ data: found ?? null, error: null });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  store = [];
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('issueOtp', () => {
  it('returns a reference and expiresAt', async () => {
    const db = makeDb();
    const result = await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    expect(result.reference).toBeDefined();
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('inserts one row into the otps table', async () => {
    const db = makeDb();
    await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    expect(store).toHaveLength(1);
    expect(store[0].email).toBe('user@gmail.com');
    expect(store[0].purpose).toBe('registration');
    expect(store[0].code).toMatch(/^\d{6}$/);
  });

  it('returns inline code for any email in non-production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const db = makeDb();
    const result = await issueOtp({ email: 'real@gmail.com', purpose: 'registration' }, db);
    expect(result.code).toBeDefined();
    vi.unstubAllEnvs();
  });

  it('does not return inline code in production even for test domains', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const db = makeDb();
    const result = await issueOtp({ email: 'test@example.com', purpose: 'registration' }, db);
    expect(result.code).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it('expiresAt is approximately 10 minutes in the future', async () => {
    const before = Date.now();
    const db = makeDb();
    const result = await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const after = Date.now();
    const expiresMs = result.expiresAt.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 10 * 60 * 1000);
  });
});

describe('validateOtp', () => {
  it('succeeds when code and reference match', async () => {
    const db = makeDb();
    await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const { reference, code } = store[0];
    await expect(validateOtp({ code, reference, purpose: 'registration' }, db)).resolves.toBeUndefined();
  });

  it('marks OTP as verified after successful validation', async () => {
    const db = makeDb();
    await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const { reference, code } = store[0];
    await validateOtp({ code, reference, purpose: 'registration' }, db);
    expect(store).toHaveLength(1);
    expect(store[0].verified_at).toBeDefined();
    // Re-validating same OTP should fail
    await expect(
      validateOtp({ code, reference, purpose: 'registration' }, db),
    ).rejects.toThrow('OTP_ALREADY_VERIFIED');
  });

  it('throws OTP_EXPIRED for expired codes', async () => {
    vi.useFakeTimers();
    const db = makeDb();
    await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const { reference, code } = store[0];
    vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes
    await expect(
      validateOtp({ code, reference, purpose: 'registration' }, db),
    ).rejects.toThrow('OTP_EXPIRED');
    vi.useRealTimers();
  });

  it('throws OTP_INVALID for wrong codes', async () => {
    const db = makeDb();
    await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const { reference } = store[0];
    await expect(
      validateOtp({ code: '000000', reference, purpose: 'registration' }, db),
    ).rejects.toThrow('OTP_INVALID');
  });

  it('throws OTP_NOT_FOUND when reference does not exist', async () => {
    const db = makeDb();
    await expect(
      validateOtp({ code: '123456', reference: 'nonexistent-ref', purpose: 'registration' }, db),
    ).rejects.toThrow('OTP_NOT_FOUND');
  });

  it('can validate by email instead of reference', async () => {
    const db = makeDb();
    await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const { code } = store[0];
    await expect(
      validateOtp({ code, email: 'user@gmail.com', purpose: 'registration' }, db),
    ).resolves.toBeUndefined();
  });

  it('throws when neither reference nor email is provided', async () => {
    const db = makeDb();
    await expect(
      validateOtp({ code: '123456', purpose: 'registration' }, db),
    ).rejects.toThrow('OTP_LOOKUP_REQUIRES_REFERENCE_OR_EMAIL');
  });

  it('AuthError has correct name', async () => {
    const db = makeDb();
    const err = await validateOtp({ code: '123456', reference: 'bad', purpose: 'registration' }, db).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.name).toBe('AuthError');
  });
});

describe('resendOtp', () => {
  it('returns same reference when valid OTP exists (deduplication)', async () => {
    const db = makeDb();
    const { reference } = await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const result = await resendOtp('user@gmail.com', 'registration', db);
    expect(result.reference).toBe(reference);
  });

  it('issues new OTP when no valid OTP exists', async () => {
    const db = makeDb();
    const { reference } = await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const { code } = store[0];
    // Validate the existing OTP
    await validateOtp({ code, reference, purpose: 'registration' }, db);
    const result = await resendOtp('user@gmail.com', 'registration', db);
    expect(result.reference).not.toBe(reference);
  });

  it('issues new OTP when existing OTP has expired', async () => {
    vi.useFakeTimers();
    const db = makeDb();
    const { reference } = await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes — OTP expired
    const result = await resendOtp('user@gmail.com', 'registration', db);
    expect(result.reference).not.toBe(reference);
    vi.useRealTimers();
  });

  it('returns reference and expiresAt on resend', async () => {
    const db = makeDb();
    await issueOtp({ email: 'user@gmail.com', purpose: 'registration' }, db);
    const result = await resendOtp('user@gmail.com', 'registration', db);
    expect(result.reference).toBeDefined();
    expect(result.expiresAt).toBeInstanceOf(Date);
  });
});
