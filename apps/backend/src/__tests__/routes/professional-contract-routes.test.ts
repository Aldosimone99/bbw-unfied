import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createProfessionalContractRouter } from '../../routes/professional-contract-routes';

const user = { id: 'user-1', email: 'doctor@example.com', tipo_utente: 'medico' };

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

describe('professional contract routes', () => {
  it('returns professional contract status', async () => {
    const app = express().use(express.json()).use('/professional-contract', createProfessionalContractRouter(mockDb(), () => user));
    const res = await request(app).get('/professional-contract/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ contractType: 'professional', contractRole: 'medico' });
  });
});
