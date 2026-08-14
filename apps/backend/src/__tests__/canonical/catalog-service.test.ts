import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseLike } from '../../db/supabase';
import { getAuthorizationContext } from '../../services/authorization-context-service';
import {
  createCustomTreatment,
  createTreatmentOffering,
  listTreatmentOfferings,
} from '../../services/catalog-service';

vi.mock('../../services/authorization-context-service', () => ({
  getAuthorizationContext: vi.fn(),
}));

const mockedGetAuthorizationContext = vi.mocked(getAuthorizationContext);
const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'owner@example.com', tipo_utente: 'privato' as const };
const organizationA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const organizationB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const professionalProfileId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const treatmentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const offeringId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const organizationContext = (organizationId: string) => ({
  kind: 'organization' as const,
  organizationId,
  membershipId: '11111111-1111-4111-8111-111111111111',
  label: 'Organizzazione',
  organizationTypeCode: 'clinic',
  organizationTypeDisplayName: 'Clinica',
  roles: [],
});

const treatmentRow = {
  id: treatmentId,
  external_code: 'T-001',
  name: 'Trattamento standard',
  category_id: '99999999-9999-4999-8999-999999999999',
  description: 'Descrizione',
  body_area: 'Viso',
  default_points: 2,
  default_price_cents: 1250,
  default_duration_min_minutes: 30,
  default_duration_max_minutes: 45,
  duration_label: '30-45 min',
  professional_requirements: ['physician'],
  is_active: true,
  source: 'bbw_template' as const,
  owner_organization_id: null,
  owner_professional_profile_id: null,
  treatment_categories: { id: '99999999-9999-4999-8999-999999999999', code: 'viso', display_name: 'Viso' },
};

const offeringRow = (organizationId: string) => ({
  offering_id: offeringId,
  organization_id: organizationId,
  professional_profile_id: null,
  catalog_treatment_id: treatmentId,
  external_code: 'T-001',
  name: 'Trattamento standard',
  category_code: 'viso',
  category_display_name: 'Viso',
  body_area: 'Viso',
  description: 'Descrizione locale',
  default_price_cents: 1250,
  default_duration_min_minutes: 30,
  default_duration_max_minutes: 45,
  default_points: 2,
  price_cents: 2500,
  duration_minutes: 35,
  points: 4,
  is_active: true,
  source: 'bbw_template' as const,
  owner_organization_id: null,
  owner_professional_profile_id: null,
  created_at: '2026-08-13T10:00:00.000Z',
  updated_at: '2026-08-13T10:00:00.000Z',
});

function queryFor(result: unknown) {
  const builder: Record<string, any> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: result, error: null }));
  return builder;
}

function makeDb(organizationId: string) {
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'list_accessible_treatment_definitions') {
      expect(args).toEqual({ p_scope_kind: 'organization', p_scope_id: organizationId });
      return { data: [treatmentRow], error: null };
    }
    if (name === 'create_organization_treatment_offering') return { data: offeringId, error: null };
    if (name === 'list_organization_treatment_offerings_v2') {
      expect(args).toEqual({ p_organization_id: organizationId });
      return { data: [offeringRow(organizationId)], error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  return {
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'catalog_treatments') return queryFor(treatmentRow);
      throw new Error(`Unexpected table ${table}`);
    }),
  } as unknown as SupabaseLike;
}

describe('catalog service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('derives organization scope and forwards custom cents without changing the master treatment', async () => {
    const context = organizationContext(organizationA);
    mockedGetAuthorizationContext.mockResolvedValue({ activeOperationalContext: context, operationalPermissions: ['catalog.offering.create', 'catalog.offering.read'] } as never);
    const db = makeDb(organizationA);

    const result = await createTreatmentOffering(
      db,
      user,
      { kind: 'organization', id: organizationA },
      { catalogTreatmentId: treatmentId, priceCents: 2500, durationMinutes: 35, points: 4 },
    );

    expect(result).toMatchObject({ priceCents: 2500, durationMinutes: 35, points: 4, defaultPriceCents: 1250 });
    expect(vi.mocked(db.rpc)).toHaveBeenCalledWith('create_organization_treatment_offering', expect.objectContaining({
      p_organization_id: organizationA,
      p_price_cents: 2500,
      p_duration_minutes: 35,
      p_points: 4,
    }));
  });

  it('keeps organization A and B offering queries isolated by the active context', async () => {
    const dbA = makeDb(organizationA);
    mockedGetAuthorizationContext.mockResolvedValue({ activeOperationalContext: organizationContext(organizationA), operationalPermissions: ['catalog.offering.read'] } as never);
    const resultA = await listTreatmentOfferings(dbA, user, { kind: 'organization', id: organizationA });
    expect(resultA[0]?.organizationId).toBe(organizationA);

    const dbB = makeDb(organizationB);
    mockedGetAuthorizationContext.mockResolvedValue({ activeOperationalContext: organizationContext(organizationB), operationalPermissions: ['catalog.offering.read'] } as never);
    const resultB = await listTreatmentOfferings(dbB, user, { kind: 'organization', id: organizationB });
    expect(resultB[0]?.organizationId).toBe(organizationB);
    expect(vi.mocked(dbB.rpc)).toHaveBeenCalledWith('list_organization_treatment_offerings_v2', { p_organization_id: organizationB });
  });

  it('rejects a request whose context does not match the authorized active context', async () => {
    mockedGetAuthorizationContext.mockResolvedValue({ activeOperationalContext: organizationContext(organizationA), operationalPermissions: ['catalog.offering.read'] } as never);
    const db = makeDb(organizationA);

    await expect(listTreatmentOfferings(db, user, { kind: 'organization', id: organizationB })).rejects.toMatchObject({ code: 'OPERATIONAL_CONTEXT_FORBIDDEN', status: 403 });
    expect(vi.mocked(db.rpc)).not.toHaveBeenCalled();
  });

  it('uses the personal professional scope without accepting an organization identifier', async () => {
    const context = {
      kind: 'personal_professional' as const,
      professionalProfileId,
      label: 'Studio personale',
      professionalTypeCode: 'physician',
      professionalTypeDisplayName: 'Medico',
    };
    mockedGetAuthorizationContext.mockResolvedValue({ activeOperationalContext: context, operationalPermissions: ['catalog.offering.read'] } as never);
    const db = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        expect(name).toBe('list_professional_treatment_offerings_v2');
        expect(args).toEqual({ p_professional_profile_id: professionalProfileId });
        return { data: [{ ...offeringRow(organizationA), organization_id: null, professional_profile_id: professionalProfileId }], error: null };
      }),
    } as unknown as SupabaseLike;

    const result = await listTreatmentOfferings(db, user, { kind: 'personal_professional', id: professionalProfileId });
    expect(result[0]).toMatchObject({ scope: 'personal_professional', organizationId: null, professionalProfileId });
  });
});

  it('creates an organization-owned custom treatment through the scoped canonical RPC', async () => {
    mockedGetAuthorizationContext.mockResolvedValue({ activeOperationalContext: organizationContext(organizationA), operationalPermissions: ['catalog.offering.create'] } as never);
    const db = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        expect(name).toBe('create_organization_custom_treatment');
        expect(args).toMatchObject({
          p_actor_user_id: user.id,
          p_organization_id: organizationA,
          p_name: 'Trattamento locale',
          p_category_id: '99999999-9999-4999-8999-999999999999',
          p_price_cents: 3000,
          p_duration_minutes: 60,
          p_points: 5,
        });
        return { data: { definition_id: treatmentId, offering_id: offeringId }, error: null };
      }),
    } as unknown as SupabaseLike;

    await expect(createCustomTreatment(db, user, { kind: 'organization', id: organizationA }, {
      name: 'Trattamento locale',
      categoryId: '99999999-9999-4999-8999-999999999999',
      priceCents: 3000,
      durationMinutes: 60,
      points: 5,
    })).resolves.toEqual({ definitionId: treatmentId, offeringId });
  });
