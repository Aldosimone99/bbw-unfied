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

import { createTokenRouter } from '../../../routes/auth/token-routes';
import { rateLimit, RateLimitError } from '../../../services/rate-limit-service';
import { issueSensitiveToken } from '../../../services/sensitive-token-service';

const mockRateLimit = vi.mocked(rateLimit);
const mockIssueSensitiveToken = vi.mocked(issueSensitiveToken);

type OtpRow = {
  reference: string;
  email: string;
  purpose: string;
  code: string;
  expires_at: string;
  user_id: string | null;
};

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function makeReq(body: Record<string, unknown> = {}, ip = '127.0.0.1', user?: Record<string, unknown>) {
  return { body, ip, user } as never;
}

function getHandler(router: any, path: string, method: string) {
  const route = router.stack.find((r: any) => r.route?.path === path && r.route.methods[method]);
  if (!route) throw new Error(`Route ${method} ${path} not found`);
  return route.route.stack[route.route.stack.length - 1].handle;
}

let store: OtpRow[] = [];

function makeStoreDb() {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'otps') throw new Error(`unexpected table: ${table}`);
      return {
        insert: vi.fn((row: OtpRow) => {
          store.push(row);
          return Promise.resolve({ error: null });
        }),
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() => {
              const latest = store.length > 0 ? store[store.length - 1] : null;
              return Promise.resolve({ data: latest, error: null });
            }),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        delete: vi.fn(() => ({
          eq: vi.fn().mockImplementation(() => {
            store.length = 0;
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }),
  };
}

describe('GET /verify', () => {
  it('returns user for valid token (resolveUser sets req.user)', async () => {
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/verify', 'get');
    const res = makeRes();

    await handler(makeReq({}, '127.0.0.1', { id: 'user-1', email: 'mario@example.com', tipo_utente: 'cliente' }), res as never);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: { id: 'user-1', email: 'mario@example.com', tipo_utente: 'cliente' },
    });
  });
});

describe('POST /consent-otp/request', () => {
  beforeEach(() => {
    store = [];
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with reference and expiresAt', async () => {
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/request', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', purpose: 'registration' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    expect(jsonCall.reference).toBeDefined();
    expect(jsonCall.expiresAt).toBeDefined();
  });

  it('returns 422 for invalid payload', async () => {
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/request', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'not-an-email', purpose: 'registration' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('applies rate limits: 5 per email, 20 per IP', async () => {
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/request', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', purpose: 'registration' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'consent-otp:mario@example.com', limit: 5 }),
    );
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'consent-otp-ip:127.0.0.1', limit: 20 }),
    );
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockRejectedValueOnce(new RateLimitError('RATE_LIMIT_EXCEEDED'));
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/request', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', purpose: 'registration' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('POST /consent-otp/verify', () => {
  beforeEach(() => {
    store = [];
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
    vi.stubEnv('NODE_ENV', 'production');
    // Seed an OTP into the store
    store.push({
      reference: '00000000-0000-0000-0000-000000000001',
      email: 'mario@example.com',
      purpose: 'consent',
      code: '123456',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      user_id: 'user-1',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with sensitive token on valid OTP', async () => {
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/verify', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', purpose: 'registration', code: '123456' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        verificationToken: 'mock-sensitive-token',
      }),
    );
  });

  it('calls issueSensitiveToken with correct params on successful verification', async () => {
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/verify', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', purpose: 'registration', code: '123456' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(mockIssueSensitiveToken).toHaveBeenCalledWith({
      userId: 'user-1',
      method: 'otp',
      purpose: 'consent_signing',
      req: expect.objectContaining({ ip: '127.0.0.1' }),
    });
  });

  it('applies rate limits: 8 per email, 30 per IP', async () => {
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/verify', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', purpose: 'registration', code: '123456' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'consent-otp-verify:mario@example.com', limit: 8 }),
    );
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'consent-otp-verify-ip:127.0.0.1', limit: 30 }),
    );
  });

  it('returns 401 when OTP is invalid (wrong code)', async () => {
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/verify', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', purpose: 'registration', code: '000000' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockRejectedValueOnce(new RateLimitError('RATE_LIMIT_EXCEEDED'));
    const handler = getHandler(createTokenRouter(makeStoreDb()), '/consent-otp/verify', 'post');
    const res = makeRes();

    await handler(makeReq({ email: 'mario@example.com', purpose: 'registration', code: '123456' }, '127.0.0.1', { id: 'user-1' }), res as never);

    expect(res.status).toHaveBeenCalledWith(429);
  });
});
