import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// Prevent unhandled 'error' events from crashing the process.
// ioredis emits 'error' on reconnect failures; without a listener Node.js
// treats it as an uncaught exception.
redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});
