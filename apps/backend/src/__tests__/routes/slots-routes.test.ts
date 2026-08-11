import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../index';

describe('slots routes', () => {
  it('requires professionalId for days', async () => {
    const response = await request(createApp({ from: vi.fn() } as any)).get('/slots/days?from=2026-07-01&to=2026-07-31');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PROFESSIONAL_ID_REQUIRED');
  });

  it('requires professionalId for slots', async () => {
    const response = await request(createApp({ from: vi.fn() } as any)).get('/slots?date=2026-07-01');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PROFESSIONAL_ID_REQUIRED');
  });
});
