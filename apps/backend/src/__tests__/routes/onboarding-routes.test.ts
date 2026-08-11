import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createOnboardingRouter } from '../../routes/onboarding-routes';

function mockDb() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
  };
}

describe('onboarding routes', () => {
  it('returns onboarding status for authenticated user', async () => {
    const db = mockDb();
    const app = express().use('/onboarding', createOnboardingRouter(db, () => ({ id: 'user-1', tipo_utente: 'medico' })));
    const res = await request(app).get('/onboarding/status');
    expect(res.status).toBe(200);
    expect(res.body.data.steps.length).toBeGreaterThan(0);
  });
});
