import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../lib/redis';

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Cache limiters by config so state accumulates correctly across calls
const limiterCache = new Map<string, RateLimiterRedis>();

function getLimiter(opts: { limit: number; window: number }): RateLimiterRedis {
  const cacheKey = `${opts.limit}:${opts.window}`;
  if (!limiterCache.has(cacheKey)) {
    limiterCache.set(
      cacheKey,
      new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl',
        points: opts.limit,
        duration: Math.ceil(opts.window / 1000),
      }),
    );
  }
  return limiterCache.get(cacheKey)!;
}

export async function rateLimit(opts: {
  key: string;
  limit: number;
  window: number; // milliseconds
}): Promise<void> {
  if (process.env.RATE_LIMIT_ENABLED === 'false') return;

  const limiter = getLimiter(opts);

  try {
    await limiter.consume(opts.key);
  } catch {
    throw new RateLimitError('RATE_LIMIT_EXCEEDED');
  }
}

/** @internal — test use only */
export function __clearLimiterCacheForTesting(): void {
  limiterCache.clear();
}
