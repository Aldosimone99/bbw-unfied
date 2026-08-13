import { describe, expect, it } from 'vitest';
import {
  getAvailableOperationalContexts,
  resolveOperationalContext,
} from '../../services/authorization-context-service';

const userId = '00000000-0000-4000-8000-000000000001';
const professionalProfileId = '00000000-0000-4000-8000-000000000002';
const organizationId = '00000000-0000-4000-8000-000000000003';
const membershipId = '00000000-0000-4000-8000-000000000004';

function availableContexts(input: {
  memberships?: unknown[];
  professionalProfiles?: unknown[];
  rolesByMembershipId?: ReadonlyMap<string, Array<{ code: string; displayName: string }>>;
}) {
  return getAvailableOperationalContexts(userId, {
    memberships: (input.memberships ?? []) as never,
    professionalProfiles: (input.professionalProfiles ?? []) as never,
    organizationTypeById: new Map([["type-1", { id: 'type-1', code: 'clinic', display_name: 'Clinica' }]]),
    rolesByMembershipId: input.rolesByMembershipId ?? new Map(),
  });
}

function operationalProfessionalProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: professionalProfileId,
    user_id: userId,
    display_name: 'Studio Mario Rossi',
    verification_status: 'verified',
    professional_types: { code: 'physician', display_name: 'Medico', verification_required: true, is_active: true },
    ...overrides,
  };
}

function activeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: membershipId,
    user_id: userId,
    organization_id: organizationId,
    status: 'active',
    joined_at: '2026-08-12T10:00:00.000Z',
    organizations: {
      id: organizationId,
      display_name: 'Clinica Aurora',
      legal_name: null,
      tax_identifier: null,
      email: null,
      phone: null,
      registered_address: null,
      status: 'active',
      organization_type_id: 'type-1',
    },
    ...overrides,
  };
}

describe('available operational contexts', () => {
  it('keeps a pending professional profile selectable while verification controls operational permissions', () => {
    expect(availableContexts({ professionalProfiles: [operationalProfessionalProfile({ verification_status: 'pending' })] })).toEqual([{
      kind: 'personal_professional',
      professionalProfileId,
      label: 'Studio Mario Rossi',
      professionalTypeCode: 'physician',
      professionalTypeDisplayName: 'Medico',
    }]);
  });

  it('derives a personal professional workspace from owned operational profile data', () => {
    expect(availableContexts({ professionalProfiles: [operationalProfessionalProfile()] })).toEqual([{
      kind: 'personal_professional',
      professionalProfileId,
      label: 'Studio Mario Rossi',
      professionalTypeCode: 'physician',
      professionalTypeDisplayName: 'Medico',
    }]);
  });

  it('uses a neutral personal workspace label when no studio name is available', () => {
    expect(availableContexts({ professionalProfiles: [operationalProfessionalProfile({ display_name: null })] })).toMatchObject([{
      kind: 'personal_professional',
      label: 'Il tuo studio',
    }]);
  });

  it('returns personal and organization workspaces independently with informative roles', () => {
    const contexts = availableContexts({
      professionalProfiles: [operationalProfessionalProfile()],
      memberships: [activeMembership()],
      rolesByMembershipId: new Map([[membershipId, [{ code: 'practitioner', displayName: 'Professionista' }]]]),
    });

    expect(contexts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'personal_professional', professionalProfileId }),
      expect.objectContaining({ kind: 'organization', organizationId, membershipId, roles: [{ code: 'practitioner', displayName: 'Professionista' }] }),
    ]));
  });

  it('supports more than one owned operational professional profile explicitly', () => {
    const secondProfileId = '00000000-0000-4000-8000-000000000005';
    const contexts = availableContexts({
      professionalProfiles: [operationalProfessionalProfile(), operationalProfessionalProfile({ id: secondProfileId, display_name: 'Studio Secondario' })],
    });
    expect(contexts).toHaveLength(2);
    expect(contexts.map((context) => context.kind)).toEqual(['personal_professional', 'personal_professional']);
  });

  it.each([
    ['pending membership', activeMembership({ status: 'pending' })],
    ['suspended membership', activeMembership({ status: 'suspended' })],
    ['revoked membership', activeMembership({ status: 'revoked' })],
    ['inactive organization', activeMembership({ organizations: { ...activeMembership().organizations, status: 'suspended' } })],
    ['membership of another account', activeMembership({ user_id: '00000000-0000-4000-8000-000000000099' })],
  ])('excludes a %s', (_label, membership) => {
    expect(availableContexts({ memberships: [membership] })).toEqual([]);
  });

  it('removes a revoked clinic once and restores it once after canonical reactivation', () => {
    const input = {
      professionalProfiles: [operationalProfessionalProfile()],
      rolesByMembershipId: new Map([[membershipId, [{ code: 'practitioner', displayName: 'Professionista' }]]]),
    };
    const active = availableContexts({ ...input, memberships: [activeMembership()] });
    const removed = availableContexts({ ...input, memberships: [activeMembership({ status: 'revoked' })] });
    const reactivated = availableContexts({ ...input, memberships: [activeMembership({ status: 'active' })] });

    expect(active.filter((context) => context.kind === 'organization')).toHaveLength(1);
    expect(removed.filter((context) => context.kind === 'organization')).toHaveLength(0);
    expect(reactivated.filter((context) => context.kind === 'organization')).toHaveLength(1);
    expect(reactivated).toHaveLength(2);
  });
});

describe('operational context resolution', () => {
  it('auto-selects the sole available context', () => {
    const [personalContext] = availableContexts({ professionalProfiles: [operationalProfessionalProfile()] });
    expect(resolveOperationalContext([personalContext!], undefined)).toEqual(personalContext);
  });

  it('requires a valid preference when more than one context exists', () => {
    const contexts = availableContexts({ professionalProfiles: [operationalProfessionalProfile()], memberships: [activeMembership()] });
    expect(resolveOperationalContext(contexts, undefined)).toBeNull();
    expect(resolveOperationalContext(contexts, { kind: 'organization', id: organizationId })).toMatchObject({ kind: 'organization', organizationId });
    expect(resolveOperationalContext(contexts, { kind: 'organization', id: '00000000-0000-4000-8000-000000000099' })).toBeNull();
  });

  it('falls back to the sole context when a revoked membership invalidates a stale preference', () => {
    const [personalContext] = availableContexts({ professionalProfiles: [operationalProfessionalProfile()] });
    expect(resolveOperationalContext([personalContext!], { kind: 'organization', id: organizationId })).toEqual(personalContext);
  });
});
