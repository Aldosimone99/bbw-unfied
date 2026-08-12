import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OperationalReadiness } from '@bbw/interfaces';
import { AuthorizationError, UnauthenticatedError } from '../../lib/errors/app-error';
import { getPostLoginContext, type PostLoginContext } from '../services/post-login-service';
import { assertPermission, can, hasPermission, requirePermission } from './permissions';

vi.mock('../services/post-login-service', () => ({ getPostLoginContext: vi.fn() }));

const mockedGetPostLoginContext = vi.mocked(getPostLoginContext);
const readiness: OperationalReadiness = {
  personal_profile: { complete: true, missing_fields: [] },
  organization: { applicable: false, complete: false, missing_fields: [] },
  professional: { applicable: false, profile_complete: false, verification_status: null, operational: false, blockers: [], profiles: [] },
};
const authorizationContext: PostLoginContext = {
  user: { id: 'user-1', email: 'user@example.com' }, profile: null, memberships: [],
  globalPermissions: ['dashboard.access'], organizationPermissions: [], permissions: ['dashboard.access'],
  activeOrganization: null, readiness,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetPostLoginContext.mockResolvedValue(authorizationContext);
});

describe('permission guards', () => {
  it('recognizes an assigned permission', () => {
    expect(hasPermission(new Set(['dashboard.access'] as const), 'dashboard.access')).toBe(true);
  });

  it('rejects a missing permission', () => {
    expect(() => assertPermission(new Set(['profile.read_own'] as const), 'dashboard.access')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN', name: AuthorizationError.name }),
    );
  });

  it('returns false when the user is not authenticated', async () => {
    mockedGetPostLoginContext.mockResolvedValue({ ...authorizationContext, user: null, permissions: [] });
    await expect(can('dashboard.access')).resolves.toBe(false);
    await expect(requirePermission('dashboard.access')).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('checks permissions through the current authorization context', async () => {
    await expect(can('dashboard.access')).resolves.toBe(true);
    await expect(can('organization.read')).resolves.toBe(false);
    await expect(requirePermission('dashboard.access')).resolves.toBeUndefined();
    await expect(requirePermission('organization.read')).rejects.toBeInstanceOf(AuthorizationError);
  });
});
