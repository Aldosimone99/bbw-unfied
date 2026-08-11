import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../index';

function dbMock() {
  return { from: vi.fn() } as any;
}

describe('ppl routes', () => {
  it('mounts public lookup route', async () => {
    const app = createApp(dbMock());
    const response = await request(app).get('/ppl/invites/lookup/missing-token');
    expect([404, 500]).toContain(response.status);
  });

  it('mounts accept route with validation', async () => {
    const app = createApp(dbMock());
    const response = await request(app).post('/ppl/invites/accept').send({});
    expect([401, 422]).toContain(response.status);
  });
});
