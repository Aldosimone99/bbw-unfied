import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createCompanyCatalogRouter } from '../../../routes/catalog/company-routes';

function app() {
  const db = {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'owner' }, error: null }),
    })),
  };
  return express()
    .use(express.json())
    .use('/catalog/company', createCompanyCatalogRouter(db));
}

describe('company catalog routes', () => {
  it('returns 401 without auth on GET', async () => {
    const res = await request(app()).get('/catalog/company?companyId=c-1');
    expect(res.status).toBe(401);
  });

  it('returns 401 without auth on POST adopt', async () => {
    const res = await request(app()).post('/catalog/company/adopt').send({ companyId: 'c-1', platformTreatmentId: 't-1' });
    expect(res.status).toBe(401);
  });
});
