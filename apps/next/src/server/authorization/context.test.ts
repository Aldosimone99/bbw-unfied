import { describe, expect, it } from 'vitest';

import type { OperationalContext, PermissionCode } from '../../types/authorization';
import { resolveEffectivePermissions, selectActiveOperationalContext } from './context';

const personalContext: OperationalContext = {
  kind: 'personal_professional', professionalProfileId: '00000000-0000-4000-8000-000000000002', label: 'Studio Mario Rossi', professionalTypeCode: 'physician', professionalTypeDisplayName: 'Medico',
};
const organizationContext: OperationalContext = {
  kind: 'organization', organizationId: '00000000-0000-4000-8000-000000000003', membershipId: '00000000-0000-4000-8000-000000000004', label: 'Clinica Aurora', organizationTypeCode: 'clinic', organizationTypeDisplayName: 'Clinica', roles: [],
};

describe('operational context selection', () => {
  it('selects the sole context automatically', () => {
    expect(selectActiveOperationalContext([personalContext])).toEqual(personalContext);
  });

  it('uses a valid reference with several contexts and rejects stale references', () => {
    expect(selectActiveOperationalContext([personalContext, organizationContext], { kind: 'organization', id: organizationContext.organizationId })).toEqual(organizationContext);
    expect(selectActiveOperationalContext([personalContext, organizationContext], { kind: 'organization', id: '00000000-0000-4000-8000-000000000099' })).toBeNull();
    expect(selectActiveOperationalContext([personalContext, organizationContext])).toBeNull();
  });
});

describe('scoped permission resolution', () => {
  it('does not leak organization permissions into personal context or another organization', () => {
    const personal = resolveEffectivePermissions({
      globalPermissions: ['dashboard.access'],
      operationalPermissions: ['professional_profile.read_own'],
    });
    const practitioner = resolveEffectivePermissions({
      globalPermissions: ['dashboard.access'],
      operationalPermissions: ['organization.read'],
    });
    const administrator = resolveEffectivePermissions({
      globalPermissions: ['dashboard.access'],
      operationalPermissions: ['organization.read', 'organization.members.manage'],
    });

    expect(personal.permissions).toEqual(['dashboard.access', 'professional_profile.read_own']);
    expect(practitioner.permissions).toEqual(['dashboard.access', 'organization.read']);
    expect(administrator.permissions).toEqual(['dashboard.access', 'organization.read', 'organization.members.manage']);
    expect(new Set<PermissionCode>(personal.permissions)).not.toEqual(new Set<PermissionCode>(practitioner.permissions));
    expect(new Set<PermissionCode>(practitioner.permissions)).not.toEqual(new Set<PermissionCode>(administrator.permissions));
  });
});
