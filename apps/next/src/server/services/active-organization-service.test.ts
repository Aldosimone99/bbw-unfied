import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cookies } from 'next/headers';
import type { OperationalReadiness } from '@bbw/interfaces';
import { AuthorizationError, InvalidInputError } from '../../lib/errors/app-error';
import type { MembershipSummary } from '../../types/authorization';
import { getPostLoginContext } from './post-login-service';
import { resolveActiveOrganization, setActiveOrganization } from './active-organization-service';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('./post-login-service', () => ({ getPostLoginContext: vi.fn() }));

const mockedCookies = vi.mocked(cookies);
const mockedGetPostLoginContext = vi.mocked(getPostLoginContext);
const organizationId = '00000000-0000-4000-8000-000000000001';
const readiness: OperationalReadiness = {
  personal_profile: { complete: true, missing_fields: [] }, organization: { applicable: true, complete: true, missing_fields: [] },
  professional: { applicable: false, profile_complete: false, verification_status: null, operational: false, blockers: [], profiles: [] },
};
const membership: MembershipSummary = {
  id: '00000000-0000-4000-8000-000000000002', organizationId, organizationDisplayName: 'Studio BBW',
  organizationTypeCode: 'independent_practice', organizationTypeDisplayName: 'Studio professionale', organizationStatus: 'active', status: 'active', joinedAt: null, roles: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetPostLoginContext.mockResolvedValue({
    user: { id: 'user-1', email: 'user@example.com' }, profile: null, memberships: [membership], globalPermissions: [], organizationPermissions: [], permissions: [], activeOrganization: membership, readiness,
  });
  mockedCookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() } as unknown as Awaited<ReturnType<typeof cookies>>);
});

describe('active organization selection', () => {
  it('uses the first active organization when there is no valid cookie', () => {
    expect(resolveActiveOrganization([membership, { ...membership, id: 'membership-3', organizationId: 'organization-2' }], 'missing')?.organizationId).toBe(organizationId);
  });

  it('returns null after the active membership is removed', () => {
    expect(resolveActiveOrganization([{ ...membership, status: 'revoked' }], organizationId)).toBeNull();
  });

  it('validates the client value and persists only a verified membership', async () => {
    await setActiveOrganization(organizationId);
    expect((await mockedCookies.mock.results[0]?.value).set).toHaveBeenCalledWith('bbw-active-organization', organizationId, expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
  });

  it('rejects a manipulated or unauthorized organization id', async () => {
    await expect(setActiveOrganization('not-a-uuid')).rejects.toBeInstanceOf(InvalidInputError);
    mockedGetPostLoginContext.mockResolvedValueOnce({
      user: { id: 'user-1', email: 'user@example.com' }, profile: null, memberships: [], globalPermissions: [], organizationPermissions: [], permissions: [], activeOrganization: null, readiness,
    });
    await expect(setActiveOrganization(organizationId)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
