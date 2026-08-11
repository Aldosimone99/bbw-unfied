import { describe, expect, it, vi, beforeEach } from 'vitest';

const { isolatedSignIn } = vi.hoisted(() => ({ isolatedSignIn: vi.fn() }));

vi.mock('../../../db/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({ auth: { signInWithPassword: isolatedSignIn } })),
}));

vi.mock('../../../services/rate-limit-service', () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  },
}));

import { createLoginHandler } from '../../../routes/auth/login-routes';
import { RateLimitError } from '../../../services/rate-limit-service';

const mockSession = {
  access_token: 'access-jwt',
  refresh_token: 'refresh-jwt',
};

const baseUser = {
  id: 'user-uuid-1',
  email: 'mario@example.com',
  tipo_utente: 'cliente',
  nome: 'Mario',
  cognome: 'Rossi',
};

function userQuery(data: Record<string, unknown> | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

function makeDb(overrides: {
  user?: Record<string, unknown> | null;
  authError?: unknown;
  session?: typeof mockSession | null;
} = {}) {
  const { user = baseUser, authError = null, session = mockSession } = overrides;

  const db = {
    from: vi.fn().mockReturnValue(userQuery(user)),
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

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

function makeReq(body: Record<string, unknown>, ip = '127.0.0.1') {
  return { body, ip } as never;
}

describe('POST /auth/login handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with user, token, refreshToken on valid credentials', async () => {
    const handler = createLoginHandler(makeDb());
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', password: 'Pass123!' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        token: 'access-jwt',
        refreshToken: 'refresh-jwt',
        user: expect.objectContaining({ email: 'mario@example.com', tipo_utente: 'cliente' }),
      }),
    );
  });

  it('returns 422 when userType=privato is provided (rejected by schema)', async () => {
    const handler = createLoginHandler(makeDb());
    const res = makeRes();

    await handler(
      makeReq({ email: 'mario@example.com', password: 'Pass123!', userType: 'privato' }),
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_FAILED' }));
  });

  it('returns 422 when body is missing both email and codiceFiscale', async () => {
    const handler = createLoginHandler(makeDb());
    const res = makeRes();

    await handler(makeReq({ password: 'Pass123!' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 422 when password is missing', async () => {
    const handler = createLoginHandler(makeDb());
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 401 when user is not found', async () => {
    const handler = createLoginHandler(makeDb({ user: null }));
    const res = makeRes();

    await handler(makeReq({ email: 'nobody@example.com', password: 'Pass123!' }), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'INVALID_CREDENTIALS' });
  });

  it('returns 401 when password is wrong', async () => {
    const handler = createLoginHandler(makeDb({ authError: new Error('Invalid credentials') }));
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', password: 'WrongPass!' }), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'INVALID_CREDENTIALS' });
  });

  it('returns 401 ROLE_MISMATCH when userType does not match', async () => {
    const handler = createLoginHandler(makeDb({ user: { ...baseUser, tipo_utente: 'cliente' } }));
    const res = makeRes();

    await handler(
      makeReq({ email: 'mario@example.com', password: 'Pass123!', userType: 'medico' }),
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'ROLE_MISMATCH' });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { rateLimit } = await import('../../../services/rate-limit-service');
    const mockRateLimit = vi.mocked(rateLimit);
    mockRateLimit.mockRejectedValueOnce(new RateLimitError('RATE_LIMIT_EXCEEDED'));

    const handler = createLoginHandler(makeDb());
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', password: 'Pass123!' }), res as never);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'RATE_LIMIT_EXCEEDED' });
  });

  it('allows admin to log in regardless of userType param', async () => {
    const handler = createLoginHandler(makeDb({ user: { ...baseUser, tipo_utente: 'admin' } }));
    const res = makeRes();

    await handler(
      makeReq({ email: 'mario@example.com', password: 'Pass123!', userType: 'medico' }),
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it('works with codiceFiscale instead of email', async () => {
    const handler = createLoginHandler(makeDb());
    const res = makeRes();

    await handler(
      makeReq({ codiceFiscale: 'RSSMRA80A01H501U', password: 'Pass123!' }),
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
