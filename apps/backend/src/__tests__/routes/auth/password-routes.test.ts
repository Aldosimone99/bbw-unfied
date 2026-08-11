import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../services/rate-limit-service', () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {
    constructor(message: string) { super(message); this.name = 'RateLimitError'; }
  },
}));

vi.mock('../../../services/sensitive-token-service', () => ({
  issueSensitiveToken: vi.fn().mockReturnValue({
    verificationToken: 'mock-sensitive-token',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }),
}));

vi.mock('../../../middleware/resolve-user-middleware', () => ({
  resolveUser: vi.fn(() => (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', email: 'mario@example.com', tipo_utente: 'cliente' };
    next();
  }),
}));

import { createPasswordRouter } from '../../../routes/auth/password-routes';
import { rateLimit, RateLimitError } from '../../../services/rate-limit-service';

const mockRateLimit = vi.mocked(rateLimit);

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function makeReq(body: Record<string, unknown>, ip = '127.0.0.1', user?: Record<string, unknown>) {
  return { body, ip, user } as never;
}

function makeDb() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { email: 'mario@example.com' }, error: null }),
        })),
      })),
    })),
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      admin: {
        generateLink: vi.fn().mockResolvedValue({ data: { properties: {} }, error: null }),
        updateUserById: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
      },
    },
  };
}

function getHandler(router: any, path: string) {
  const route = router.stack.find((r: any) => r.route?.path === path);
  if (!route) throw new Error(`Route ${path} not found`);
  return route.route.stack[0].handle;
}

describe('POST /forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
  });

  it('returns 200 for valid email', async () => {
    const handler = getHandler(createPasswordRouter(makeDb()), '/forgot-password');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 200 even for non-existent email (anti-enumeration)', async () => {
    const handler = getHandler(createPasswordRouter(makeDb()), '/forgot-password');
    const res = makeRes();

    await handler(makeReq({ email: 'nobody@example.com' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 422 when email is invalid', async () => {
    const handler = getHandler(createPasswordRouter(makeDb()), '/forgot-password');
    const res = makeRes();

    await handler(makeReq({ email: 'not-an-email' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockRejectedValueOnce(new RateLimitError('RATE_LIMIT_EXCEEDED'));
    const handler = getHandler(createPasswordRouter(makeDb()), '/forgot-password');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com' }), res as never);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'RATE_LIMIT_EXCEEDED' });
  });
});

describe('POST /reset-password', () => {
  it('returns 422 for weak passwords', async () => {
    const handler = getHandler(createPasswordRouter(makeDb()), '/reset-password');
    const res = makeRes();

    await handler(makeReq({ newPassword: 'short' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 422 with specific error code for weak passwords', async () => {
    const handler = getHandler(createPasswordRouter(makeDb()), '/reset-password');
    const res = makeRes();

    await handler(makeReq({ newPassword: 'short' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.issues).toContain('PASSWORD_TOO_SHORT');
  });

  it('returns 200 for strong passwords (with tokenHash to get userId)', async () => {
    const handler = getHandler(createPasswordRouter(makeDb()), '/reset-password');
    const res = makeRes();

    await handler(makeReq({ newPassword: 'StrongPass123!', tokenHash: 'valid-token' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 200 for strong passwords (with session user)', async () => {
    const handler = getHandler(createPasswordRouter(makeDb()), '/reset-password');
    const res = makeRes();

    await handler(makeReq({ newPassword: 'StrongPass123!' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('POST /verify-password', () => {
  function getVerifyHandler(router: any) {
    const route = router.stack.find((r: any) => r.route?.path === '/verify-password');
    if (!route) throw new Error('Route /verify-password not found');
    // The handler is the last in the stack (after resolveUser middleware)
    return route.route.stack[route.route.stack.length - 1].handle;
  }

  it('returns 422 when password is missing', async () => {
    const handler = getVerifyHandler(createPasswordRouter(makeDb()));
    const res = makeRes();

    await handler(makeReq({}), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 200 with verificationToken for valid password', async () => {
    const handler = getVerifyHandler(createPasswordRouter(makeDb()));
    const res = makeRes();

    await handler(makeReq({ password: 'Pass123!' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        verificationToken: 'mock-sensitive-token',
      }),
    );
  });

  it('returns 401 when password is invalid', async () => {
    const db = makeDb();
    db.auth.signInWithPassword = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Invalid login credentials'),
    });
    const handler = getVerifyHandler(createPasswordRouter(db));
    const res = makeRes();

    await handler(makeReq({ password: 'WrongPass!' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
