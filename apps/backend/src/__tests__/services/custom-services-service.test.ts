import { describe, expect, it, vi } from 'vitest';
import { createCustomService } from '../../services/custom-services-service';

function db() {
  const inserts: unknown[] = [];
  return {
    inserts,
    from: vi.fn((table: string) => ({
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: `${table}-1`, ...payload as object }, error: null }) };
      }),
    })),
  };
}

describe('custom-services-service', () => {
  it('rejects duration that is not a 30-minute multiple', async () => {
    await expect(createCustomService(db(), { id: 'pro-1' }, { name: 'X', duration: 45, priceCents: 1000 }))
      .rejects.toMatchObject({ code: 'DURATION_MUST_BE_30_MULTIPLE', status: 422 });
  });

  it('creates company service catalog row when companyId is present', async () => {
    const mocked = db();
    await createCustomService(mocked, { id: 'pro-1' }, { name: 'X', duration: 60, priceCents: 1000 }, 'company-1');
    expect(mocked.inserts.map((item: any) => item.table)).toEqual(['custom_services', 'company_service_catalog']);
  });

  it('creates professional catalog item when companyId is absent', async () => {
    const mocked = db();
    await createCustomService(mocked, { id: 'pro-1' }, { name: 'X', duration: 60, priceCents: 1000 });
    expect(mocked.inserts.map((item: any) => item.table)).toEqual(['custom_services', 'professional_catalog_items']);
  });
});
