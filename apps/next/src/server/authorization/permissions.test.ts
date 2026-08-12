import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OperationalReadiness } from '@bbw/interfaces';
import { AuthorizationError, UnauthenticatedError } from '../../lib/errors/app-error';
import { getPostLoginContext, type PostLoginContext } from '../services/post-login-service';
import {
  assertPermission,
  can,
  getAvailableOperationalContexts,
  hasPermission,
  requireOperationalPermission,
} from './permissions';

vi.mock('../services/post-login-service', () => ({ getPostLoginContext: vi.fn() }));

const mockedGetPostLoginContext = vi.mocked(getPostLoginContext);
const readiness: OperationalReadiness = {
  personal_profile: { complete: true, missing_fields: [] },
  organization: { applicable: false, complete: false, missing_fields: [] },
  professional: { applicable: true, profile_complete: true, verification_status: 'verified', operational: true, blockers: [], profiles: [] },
};
const personalContext = {
  kind: 'personal_professional' as const,
  professionalProfileId: '00000000-0000-4000-8000-000000000002',
  label: 'Studio Mario Rossi',
  professionalTypeCode: 'physician',
  professionalTypeDisplayName: 'Medico',
};
const authorizationContext: PostLoginContext = {
  user: { id: 'user-1', email: 'user@example.com' },
  profile: null,
  availableOperationalContexts: [personalContext],
  activeOperationalContext: personalContext,
  platformRoles: [],
  operationalRoles: [],
  globalPermissions: ['dashboard.access'],
  operationalPermissions: ['professional_profile.read_own'],
  permissions: ['dashboard.access', 'professional_profile.read_own'],
  readiness,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetPostLoginContext.mockResolvedValue(authorizationContext);
});

describe('operational permission guards', () => {
  it('recognizes an assigned permission', () => {
    expect(hasPermission(new Set(['dashboard.access'] as const), 'dashboard.access')).toBe(true);
  });

  it('rejects a missing permission', () => {
    expect(() => assertPermission(new Set(['profile.read_own'] as const), 'dashboard.access')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN', name: AuthorizationError.name }),
    );
  });

  it('returns false when the account is not authenticated', async () => {
    mockedGetPostLoginContext.mockResolvedValue({ ...authorizationContext, user: null, permissions: [] });
    await expect(can('dashboard.access')).resolves.toBe(false);
    await expect(requireOperationalPermission('dashboard.access')).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('uses only permissions resolved for the active operational context', async () => {
    await expect(getAvailableOperationalContexts()).resolves.toEqual([personalContext]);
    await expect(requireOperationalPermission('professional_profile.read_own')).resolves.toBeUndefined();
    await expect(requireOperationalPermission('organization.read')).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('does not let a context switch manufacture permissions', async () => {
    const organizationContext: PostLoginContext = {
      ...authorizationContext,
      activeOperationalContext: {
        kind: 'organization',
        organizationId: '00000000-0000-4000-8000-000000000003',
        membershipId: '00000000-0000-4000-8000-000000000004',
        label: 'Clinica Aurora',
        organizationTypeCode: 'clinic',
        organizationTypeDisplayName: 'Clinica',
        roles: [{ code: 'practitioner', displayName: 'Professionista' }],
      },
      operationalPermissions: ['organization.read'],
      permissions: ['dashboard.access', 'organization.read'],
    };
    mockedGetPostLoginContext.mockResolvedValue(organizationContext);
    await expect(requireOperationalPermission('organization.read')).resolves.toBeUndefined();
    await expect(requireOperationalPermission('organization.members.manage')).rejects.toBeInstanceOf(AuthorizationError);
  });
});
