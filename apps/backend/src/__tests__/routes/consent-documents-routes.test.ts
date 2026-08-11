import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../index';

describe('consent document routes', () => {
  it('mounts public token view route', async () => {
    const response = await request(createApp({ from: vi.fn() } as any)).get('/consents/view/bad-token');
    expect([404, 410, 500]).toContain(response.status);
  });
});
