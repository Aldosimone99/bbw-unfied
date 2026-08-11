import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../services/rate-limit-service', () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {
    constructor(message: string) { super(message); this.name = 'RateLimitError'; }
  },
  __clearLimiterCacheForTesting: vi.fn(),
}));

import { createOtpRouter } from '../../../routes/auth/otp-routes';
import { rateLimit, RateLimitError } from '../../../services/rate-limit-service';

const mockRateLimit = vi.mocked(rateLimit);

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function makeReq(body: Record<string, unknown>, ip = '127.0.0.1') {
  return { body, ip } as never;
}

type OtpRow = {
  reference: string;
  email: string;
  purpose: string;
  code: string;
  expires_at: string;
  user_id: string | null;
};

let store: OtpRow[] = [];

function makeDbWithStore() {
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
            const found = store.find((row) =>
              (store.length > 0), // just return the latest
            );
            const latestRow = store.length > 0 ? store[store.length - 1] : null;
            return Promise.resolve({ data: latestRow, error: null });
          }),
        })),
          delete: vi.fn(() => ({
            eq: vi.fn().mockImplementation(() => {
              store.length = 0;
              return Promise.resolve({ error: null });
            }),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
      };
    }),
  };
}

function getHandler(router: any, path: string) {
  const route = router.stack.find((r: any) => r.route?.path === path);
  if (!route) throw new Error(`Route ${path} not found`);
  return route.route.stack[0].handle;
}

describe('POST /otp/send', () => {
  beforeEach(() => {
    store = [];
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with reference and expiresAt for valid input', async () => {
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/send');
    const res = makeRes();

    await handler(makeReq({ email: 'test@example.com', purpose: 'registration' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    expect(jsonCall.reference).toBeDefined();
    expect(jsonCall.expiresAt).toBeDefined();
  });

  it('returns 422 for invalid purpose', async () => {
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/send');
    const res = makeRes();

    await handler(makeReq({ email: 'test@example.com', purpose: 'invalid_purpose' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_FAILED' }));
  });

  it('returns 422 for missing email', async () => {
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/send');
    const res = makeRes();

    await handler(makeReq({ purpose: 'registration' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('applies rate limits: 5 per email, 20 per IP', async () => {
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/send');
    const res = makeRes();

    await handler(makeReq({ email: 'test@example.com', purpose: 'registration' }), res as never);

    expect(mockRateLimit).toHaveBeenCalledTimes(2);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockRejectedValueOnce(new RateLimitError('RATE_LIMIT_EXCEEDED'));
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/send');
    const res = makeRes();

    await handler(makeReq({ email: 'test@example.com', purpose: 'registration' }), res as never);

    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('POST /otp/resend', () => {
  beforeEach(() => {
    store = [];
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with reference', async () => {
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/resend');
    const res = makeRes();

    await handler(makeReq({ email: 'test@example.com', purpose: 'registration' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    expect(jsonCall.reference).toBeDefined();
  });

  it('returns 422 for invalid input', async () => {
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/resend');
    const res = makeRes();

    await handler(makeReq({ email: 'not-an-email', purpose: 'registration' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });
});

describe('POST /otp/verify', () => {
  beforeEach(() => {
    store = [];
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 for valid OTP', async () => {
    const db = makeDbWithStore();
    const router = createOtpRouter(db);
    // First send an OTP to populate the store
    const sendHandler = getHandler(router, '/otp/send');
    const sendRes = makeRes();
    await sendHandler(makeReq({ email: 'test@example.com', purpose: 'registration' }), sendRes as never);

    const verifyHandler = getHandler(router, '/otp/verify');
    const res = makeRes();
    const storeCode = store[0]?.code;
    const storeRef = store[0]?.reference;

    await verifyHandler(makeReq({ code: storeCode, reference: storeRef, purpose: 'registration' }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 422 when code is missing', async () => {
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/verify');
    const res = makeRes();

    await handler(makeReq({ reference: 'ref-1', purpose: 'registration' }), res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 401 when OTP is invalid', async () => {
    const handler = getHandler(createOtpRouter(makeDbWithStore()), '/otp/verify');
    const res = makeRes();

    await handler(makeReq({ code: '000000', reference: '00000000-0000-0000-0000-000000000000', purpose: 'registration' }), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
