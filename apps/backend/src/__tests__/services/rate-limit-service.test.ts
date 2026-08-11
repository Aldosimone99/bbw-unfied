import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock ioredis before importing the service so no real Redis connection is made
vi.mock('ioredis', () => {
  class Redis {
    status = 'ready';
    on() { return this; }
    quit() { return Promise.resolve(); }
  }
  return { default: Redis };
});

// Mock rate-limiter-flexible to use RateLimiterMemory so tests are self-contained
vi.mock('rate-limiter-flexible', async () => {
  const actual = await vi.importActual<typeof import('rate-limiter-flexible')>('rate-limiter-flexible');
  return {
    ...actual,
    // Replace RateLimiterRedis with RateLimiterMemory so no Redis is needed
    RateLimiterRedis: actual.RateLimiterMemory,
  };
});

// Import after mocks are set up
const { rateLimit, __clearLimiterCacheForTesting } = await import('../../services/rate-limit-service');

describe('rateLimit', () => {
  beforeEach(() => {
    vi.resetModules();
    __clearLimiterCacheForTesting();
  });

  it('passes when under the limit', async () => {
    await expect(
      rateLimit({ key: 'test@example.com', limit: 10, window: 600000 }),
    ).resolves.not.toThrow();
  });

  it('throws RATE_LIMIT_EXCEEDED when over the limit', async () => {
    const key = 'over-user@example.com';
    // Consume all points
    for (let i = 0; i < 10; i++) {
      await rateLimit({ key, limit: 10, window: 600000 });
    }
    await expect(
      rateLimit({ key, limit: 10, window: 600000 }),
    ).rejects.toThrow('RATE_LIMIT_EXCEEDED');
  });

  it('respects RATE_LIMIT_ENABLED=false', async () => {
    vi.stubEnv('RATE_LIMIT_ENABLED', 'false');
    await expect(
      rateLimit({ key: 'any@example.com', limit: 1, window: 600000 }),
    ).resolves.not.toThrow();
    vi.unstubAllEnvs();
  });

  it('uses different keys independently', async () => {
    const keyA = 'user-a@example.com';
    const keyB = 'user-b@example.com';

    for (let i = 0; i < 10; i++) {
      await rateLimit({ key: keyA, limit: 10, window: 600000 });
    }
    // keyA should be at limit, keyB should not
    await expect(
      rateLimit({ key: keyA, limit: 10, window: 600000 }),
    ).rejects.toThrow('RATE_LIMIT_EXCEEDED');
    await expect(
      rateLimit({ key: keyB, limit: 10, window: 600000 }),
    ).resolves.not.toThrow();
  });
});
