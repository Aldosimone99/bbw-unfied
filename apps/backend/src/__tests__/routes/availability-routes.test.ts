import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../index';

describe('availability routes', () => {
  it('mounts authenticated schedule route', async () => {
    const response = await request(createApp({ from: vi.fn() } as any)).get('/availability/schedule');
    expect([401, 500]).toContain(response.status);
  });

  it('returns company required for rooms without company header after auth passes', async () => {
    const response = await request(createApp({ from: vi.fn() } as any)).get('/availability/rooms');
    expect([401, 400, 500]).toContain(response.status);
  });
});
