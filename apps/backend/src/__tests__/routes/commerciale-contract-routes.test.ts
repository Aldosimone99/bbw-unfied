import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createCommercialeContractRouter } from '../../routes/commerciale-contract-routes';

const user = { id: 'user-1', email: 'seller@example.com', tipo_utente: 'commerciale' };

function mockDb() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
  };
}

describe('commerciale contract routes', () => {
  it('returns contract status for authenticated commerciale', async () => {
    const app = express().use(express.json()).use('/commerciale-contract', createCommercialeContractRouter(mockDb(), () => user));
    const res = await request(app).get('/commerciale-contract/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ contractType: 'commerciale' });
  });
});
