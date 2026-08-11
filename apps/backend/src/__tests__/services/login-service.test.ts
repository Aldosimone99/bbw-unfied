import { describe, expect, it, vi, beforeEach } from 'vitest';

const { isolatedSignIn } = vi.hoisted(() => ({ isolatedSignIn: vi.fn() }));

vi.mock('../../db/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({ auth: { signInWithPassword: isolatedSignIn } })),
}));

vi.mock('../../services/rate-limit-service', () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  },
}));

import { login } from '../../services/login-service';
import { rateLimit, RateLimitError } from '../../services/rate-limit-service';

const mockRateLimit = vi.mocked(rateLimit);

/** Build a chainable query mock that resolves maybeSingle() with given data/error */
function userQuery(data: Record<string, unknown> | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

const mockReq = { ip: '127.0.0.1' };

const baseUser = {
  id: 'user-uuid-1',
  email: 'mario@example.com',
  tipo_utente: 'cliente',
  nome: 'Mario',
  cognome: 'Rossi',
};

const mockSession = {
  access_token: 'access-jwt',
  refresh_token: 'refresh-jwt',
};

function makeDb(overrides: {
  user?: Record<string, unknown> | null;
  userError?: unknown;
  authError?: unknown;
  session?: typeof mockSession | null;
} = {}) {
  const {
    user = baseUser,
    userError = null,
    authError = null,
    session = mockSession,
  } = overrides;

  const db = {
    from: vi.fn().mockReturnValue(userQuery(user, userError)),
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: authError ? null : { session },
        error: authError,
      }),
    },
  };
  isolatedSignIn.mockResolvedValue({
    data: authError ? null : { session },
    error: authError,
  });
  return db;
}

describe('login service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
  });

  it('returns success with sanitized user and tokens on valid credentials', async () => {
    const db = makeDb();

    const result = await login(db, { email: 'mario@example.com', password: 'Pass123!' }, mockReq);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');

    expect(result.user).toEqual({
      id: 'user-uuid-1',
      email: 'mario@example.com',
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
    });
    expect(result.token).toBe('access-jwt');
    expect(result.refreshToken).toBe('refresh-jwt');
  });

  it('sanitized user does not contain password or credential-like fields', async () => {
    const userWithExtras = {
      ...baseUser,
      password_hash: 'secret',
      email_preferences: { marketing: true },
      raw_user_meta_data: { foo: 'bar' },
    };
    const db = makeDb({ user: userWithExtras });

    const result = await login(db, { email: 'mario@example.com', password: 'Pass123!' }, mockReq);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user).not.toHaveProperty('email_preferences');
    expect(result.user).not.toHaveProperty('raw_user_meta_data');
    expect(Object.keys(result.user)).toEqual(expect.arrayContaining(['id', 'email', 'tipo_utente']));
  });

  it('returns 401 INVALID_CREDENTIALS when user not found', async () => {
    const db = makeDb({ user: null });

    const result = await login(db, { email: 'nobody@example.com', password: 'Pass123!' }, mockReq);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.status).toBe(401);
    expect(result.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS when password is wrong (no enumeration)', async () => {
    const db = makeDb({ authError: new Error('Invalid login credentials') });

    const result = await login(db, { email: 'mario@example.com', password: 'WrongPass!' }, mockReq);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.status).toBe(401);
    expect(result.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 ROLE_MISMATCH when userType does not match user tipo_utente', async () => {
    const db = makeDb({ user: { ...baseUser, tipo_utente: 'cliente' } });

    const result = await login(
      db,
      { email: 'mario@example.com', password: 'Pass123!', userType: 'medico' },
      mockReq,
    );

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.status).toBe(401);
    expect(result.code).toBe('ROLE_MISMATCH');
  });

  it('admin bypasses userType check and logs in regardless of userType param', async () => {
    const adminUser = { ...baseUser, tipo_utente: 'admin' };
    const db = makeDb({ user: adminUser });

    const result = await login(
      db,
      { email: 'mario@example.com', password: 'Pass123!', userType: 'medico' },
      mockReq,
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.user.tipo_utente).toBe('admin');
  });

  it('codiceFiscale as alternative identifier works', async () => {
    isolatedSignIn.mockResolvedValue({ data: { session: mockSession }, error: null });
    const db = {
      from: vi.fn().mockReturnValue(userQuery(baseUser)),
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
      },
    };

    const result = await login(
      db,
      { codiceFiscale: 'RSSMRA80A01H501U', password: 'Pass123!' },
      mockReq,
    );

    expect(result.success).toBe(true);
    // Verify the query used codice_fiscale field
    const fromCall = db.from.mock.results[0].value;
    expect(fromCall.eq).toHaveBeenCalledWith('codice_fiscale', 'RSSMRA80A01H501U');
  });

  it('rate limits by email: 11th attempt in 10 min returns 429', async () => {
    mockRateLimit.mockRejectedValueOnce(new RateLimitError('RATE_LIMIT_EXCEEDED'));
    const db = makeDb();

    await expect(
      login(db, { email: 'mario@example.com', password: 'Pass123!' }, mockReq),
    ).rejects.toThrow('RATE_LIMIT_EXCEEDED');
  });

  it('rate limits by IP: 51st attempt returns 429', async () => {
    // Let email rate limit pass, fail on IP rate limit (second call)
    mockRateLimit
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new RateLimitError('RATE_LIMIT_EXCEEDED'));
    const db = makeDb();

    await expect(
      login(db, { email: 'mario@example.com', password: 'Pass123!' }, mockReq),
    ).rejects.toThrow('RATE_LIMIT_EXCEEDED');
  });

  it('calls rateLimit twice per login attempt (by identifier and by IP)', async () => {
    const db = makeDb();

    await login(db, { email: 'mario@example.com', password: 'Pass123!' }, mockReq);

    expect(mockRateLimit).toHaveBeenCalledTimes(2);
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'mario@example.com', limit: 10 }),
    );
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: '127.0.0.1', limit: 50 }),
    );
  });

  it('suppressed email returns 422 EMAIL_SUPPRESSED', async () => {
    const mockSuppressed = vi.fn().mockResolvedValueOnce(true);
    const db = makeDb();

    const result = await login(
      db,
      { email: 'mario@example.com', password: 'Pass123!' },
      mockReq,
      mockSuppressed,
    );

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.status).toBe(422);
    expect(result.code).toBe('EMAIL_SUPPRESSED');
  });
});
