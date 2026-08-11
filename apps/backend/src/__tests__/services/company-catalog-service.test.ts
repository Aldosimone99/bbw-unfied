import { describe, expect, it, vi } from 'vitest';
import { adoptTreatment, deactivateCompanyCatalogItem, updateCompanyCatalogItem } from '../../services/company-catalog-service';

function makeDb() {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  return {
    inserts,
    updates,
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'ctc-1', ...payload as object }, error: null }) };
      }),
      update: vi.fn((payload: unknown) => {
        updates.push({ table, payload });
        return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'ctc-1', ...payload as object }, error: null }) };
      }),
    })),
  };
}

describe('company-catalog-service', () => {
  it('adopts platform treatment without copying canonical fields', async () => {
    const db = makeDb();
    await adoptTreatment(db, 'company-1', { platformTreatmentId: 'treatment-1' });
    expect(db.inserts[0]).toMatchObject({
      table: 'company_treatment_catalog',
      payload: { company_id: 'company-1', platform_treatment_id: 'treatment-1' },
    });
    expect(JSON.stringify(db.inserts[0])).not.toContain('name');
  });

  it('updates overrides and consent template', async () => {
    const db = makeDb();
    await updateCompanyCatalogItem(db, 'company-1', 'ctc-1', { priceOverrideCents: 12000, consentTemplateId: '11111111-1111-4111-8111-111111111111' });
    expect(db.updates[0]).toMatchObject({ payload: { price_override_cents: 12000, consent_template_id: '11111111-1111-4111-8111-111111111111' } });
  });

  it('deactivates a company catalog item', async () => {
    const db = makeDb();
    await deactivateCompanyCatalogItem(db, 'company-1', 'ctc-1');
    expect(db.updates[0]).toMatchObject({ payload: { is_active: false } });
  });
});
