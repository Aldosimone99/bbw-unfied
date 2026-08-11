import { describe, expect, it, vi } from 'vitest';
import { getPlatformTreatment, listPlatformTreatments } from '../../services/platform-catalog-service';

const rows = [
  { id: 'open', allowed_roles: null, is_active: true, category: 'viso' },
  { id: 'reserved', allowed_roles: [], is_active: true, category: 'viso' },
  { id: 'esthetic', allowed_roles: ['estetista'], is_active: true, category: 'estetica_base' },
];

function makeDb(data = rows) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: data[0], error: null }),
      order: vi.fn().mockResolvedValue({ data, error: null }),
    })),
  };
}

describe('platform-catalog-service', () => {
  it('returns only unrestricted active treatments for anonymous users', async () => {
    const result = await listPlatformTreatments(makeDb(), null, {});
    expect(result.map((row) => row.id)).toEqual(['open']);
  });

  it('filters by catalog roles and category for authenticated users', async () => {
    const result = await listPlatformTreatments(makeDb([{ id: 'esthetic', allowed_roles: ['estetista'], is_active: true, category: 'estetica_base' }]), { tipo_utente: 'estetista' }, { category: 'estetica_base' });
    expect(result.map((row) => row.id)).toEqual(['esthetic']);
  });

  it('rejects a treatment not allowed for the user role', async () => {
    await expect(getPlatformTreatment(makeDb([{ id: 'reserved', allowed_roles: [], is_active: true, category: 'viso' }]), { tipo_utente: 'estetista' }, 'reserved'))
      .rejects.toMatchObject({ code: 'TREATMENT_NOT_ALLOWED_FOR_ROLE', status: 403 });
  });
});
