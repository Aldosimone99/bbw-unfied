import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createReferralsRouter } from '../../routes/referrals-routes';

describe('referrals routes', () => {
  it('requires a referral query code', async () => {
    const app = express().use('/referrals', createReferralsRouter({ from: vi.fn() }));
    const res = await request(app).get('/referrals/context');
    expect(res.status).toBe(422);
  });
});
