import { describe, expect, it, vi } from 'vitest';
import { acceptDisclaimer, createAssignment } from '../../services/professional-catalog-service';

function db() {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  return {
    inserts,
    updates,
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 't-1', allowed_roles: ['estetista'], is_active: true }, error: null }),
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'a-1', ...payload as object }, error: null }) };
      }),
      update: vi.fn((payload: unknown) => {
        updates.push({ table, payload });
        return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'a-1', ...payload as object }, error: null }) };
      }),
    })),
  };
}

describe('professional-catalog-service', () => {
  it('rejects two assignment sources', async () => {
    await expect(createAssignment(db(), 'pro-1', { tipo_utente: 'estetista' }, {
      platformTreatmentId: 't-1',
      companyCatalogId: 'ctc-1',
    } as never)).rejects.toMatchObject({ code: 'EXACTLY_ONE_SOURCE_REQUIRED', status: 422 });
  });

  it('rejects consent template in clinic context', async () => {
    await expect(createAssignment(db(), 'pro-1', { tipo_utente: 'estetista' }, {
      companyCatalogId: 'ctc-1',
      consentTemplateId: '11111111-1111-4111-8111-111111111111',
    })).rejects.toMatchObject({ code: 'CONSENT_CONTROLLED_BY_CLINIC', status: 422 });
  });

  it('accepts disclaimer', async () => {
    const mocked = db();
    await acceptDisclaimer(mocked, 'pro-1', 'a-1');
    expect(mocked.updates[0]).toMatchObject({ payload: expect.objectContaining({ disclaimer_accepted: true }) });
  });
});
