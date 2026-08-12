import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../index';

const originalLegacyFlag = process.env.ENABLE_LEGACY_TRANSITION_ROUTES;
const originalCorsOrigins = process.env.CORS_ALLOWED_ORIGINS;

afterEach(() => {
  if (originalLegacyFlag === undefined) delete process.env.ENABLE_LEGACY_TRANSITION_ROUTES;
  else process.env.ENABLE_LEGACY_TRANSITION_ROUTES = originalLegacyFlag;
  if (originalCorsOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
  else process.env.CORS_ALLOWED_ORIGINS = originalCorsOrigins;
});

describe('canonical application surface', () => {
  it('exposes a minimal health endpoint without framework disclosure', async () => {
    const response = await request(createApp({} as any)).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('does not mount transition routes unless explicitly enabled', async () => {
    process.env.ENABLE_LEGACY_TRANSITION_ROUTES = 'false';
    const app = createApp({} as any);
    expect((await request(app).get('/catalog/platform')).status).toBe(404);
    expect((await request(app).get('/bookings')).status).toBe(404);
    expect((await request(app).get('/messages')).status).toBe(404);
  });

  it('rejects browser origins outside the configured allowlist', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.test';
    const response = await request(createApp({} as any))
      .get('/health')
      .set('Origin', 'https://evil.example.test');
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, code: 'CORS_ORIGIN_FORBIDDEN' });
  });

  it('allows the configured browser origin', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.test';
    const response = await request(createApp({} as any))
      .get('/health')
      .set('Origin', 'https://app.example.test');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://app.example.test');
  });
});
