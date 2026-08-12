import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cookies } from 'next/headers';
import type { OperationalContext, OperationalReadiness } from '@bbw/interfaces';
import { AuthorizationError, InvalidInputError } from '../../lib/errors/app-error';
import { getPostLoginContext, getOperationalContextReference } from './post-login-service';
import { parseOperationalContextCookie } from './operational-context-cookie';
import { resolveOperationalContext, setActiveOperationalContext } from './operational-context-service';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('./post-login-service', () => ({
  getPostLoginContext: vi.fn(),
  getOperationalContextReference: vi.fn(),
}));

const mockedCookies = vi.mocked(cookies);
const mockedGetPostLoginContext = vi.mocked(getPostLoginContext);
const mockedGetOperationalContextReference = vi.mocked(getOperationalContextReference);
const professionalProfileId = '00000000-0000-4000-8000-000000000002';
const organizationId = '00000000-0000-4000-8000-000000000003';
const personalContext: OperationalContext = {
  kind: 'personal_professional', professionalProfileId, label: 'Studio Mario Rossi', professionalTypeCode: 'physician', professionalTypeDisplayName: 'Medico',
};
const organizationContext: OperationalContext = {
  kind: 'organization', organizationId, membershipId: '00000000-0000-4000-8000-000000000004', label: 'Clinica Aurora', organizationTypeCode: 'clinic', organizationTypeDisplayName: 'Clinica', roles: [],
};
const readiness: OperationalReadiness = {
  personal_profile: { complete: true, missing_fields: [] }, organization: { applicable: false, complete: false, missing_fields: [] },
  professional: { applicable: true, profile_complete: true, verification_status: 'verified', operational: true, blockers: [], profiles: [] },
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetPostLoginContext.mockResolvedValue({
    user: { id: 'user-1', email: 'user@example.com' }, profile: null,
    availableOperationalContexts: [personalContext, organizationContext], activeOperationalContext: personalContext,
    platformRoles: [], operationalRoles: [], globalPermissions: [], operationalPermissions: ['professional_profile.read_own'], permissions: ['professional_profile.read_own'], readiness,
  });
  mockedGetOperationalContextReference.mockImplementation((context) => context.kind === 'organization'
    ? { kind: 'organization', id: context.organizationId }
    : { kind: 'personal_professional', id: context.professionalProfileId });
  mockedCookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() } as unknown as Awaited<ReturnType<typeof cookies>>);
});

describe('operational context selection', () => {
  it('ignores a modified cookie instead of treating it as authorization', () => {
    expect(parseOperationalContextCookie('{"kind":"organization","id":"not-a-uuid"}')).toBeNull();
    expect(parseOperationalContextCookie('{"kind":"organization","id":"00000000-0000-4000-8000-000000000003","role":"organization_admin"}')).toBeNull();
  });

  it('does not silently choose the first context when several are available', () => {
    expect(resolveOperationalContext([personalContext, organizationContext], null)).toBeNull();
  });

  it('uses a valid context reference and persists only its minimal verified reference', async () => {
    await setActiveOperationalContext({ kind: 'personal_professional', id: professionalProfileId });
    expect(mockedGetPostLoginContext).toHaveBeenCalledWith({ kind: 'personal_professional', id: professionalProfileId });
    expect((await mockedCookies.mock.results[0]?.value).set).toHaveBeenCalledWith(
      'bbw-active-operational-context',
      JSON.stringify({ kind: 'personal_professional', id: professionalProfileId }),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('rejects malformed, manipulated and unavailable context references', async () => {
    await expect(setActiveOperationalContext({ kind: 'organization', id: 'not-a-uuid' })).rejects.toBeInstanceOf(InvalidInputError);
    mockedGetPostLoginContext.mockResolvedValueOnce({
      user: { id: 'user-1', email: 'user@example.com' }, profile: null,
      availableOperationalContexts: [organizationContext], activeOperationalContext: organizationContext,
      platformRoles: [], operationalRoles: [], globalPermissions: [], operationalPermissions: ['organization.read'], permissions: ['organization.read'], readiness,
    });
    await expect(setActiveOperationalContext({ kind: 'personal_professional', id: professionalProfileId })).rejects.toBeInstanceOf(AuthorizationError);
  });
});
