import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createPlatformCatalogRouter } from '../../../routes/catalog/platform-routes';

function app() {
  const db = {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 't-1', allowed_roles: [], is_active: true }, error: null }),
      order: vi.fn().mockResolvedValue({ data: [{ id: 't-1', allowed_roles: null, is_active: true }], error: null }),
    })),
  };
  return express().use('/catalog/platform', createPlatformCatalogRouter(db));
}

describe('platform catalog routes', () => {
  it('lists platform treatments without auth', async () => {
    const res = await request(app()).get('/catalog/platform');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for inaccessible treatment details', async () => {
    const res = await request(app()).get('/catalog/platform/t-1');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TREATMENT_NOT_ALLOWED_FOR_ROLE');
  });
});
