import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../index';

function dbMock() {
  return { from: vi.fn() } as any;
}

describe('booking routes', () => {
  it('mounts booking list route', async () => {
    const app = createApp(dbMock());
    const response = await request(app).get('/bookings');
    expect([401, 422, 500]).toContain(response.status);
  });

  it('mounts booking creation route', async () => {
    const app = createApp(dbMock());
    const response = await request(app).post('/bookings').send({});
    expect([401, 422, 500]).toContain(response.status);
  });
});
