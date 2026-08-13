import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OperationalContext, OperationalReadiness } from '@bbw/interfaces';
import { getTransitionAuthorizationContext } from '../auth/transition-session';
import { clearActiveOperationalContext, setOperationalContextCookie } from './operational-context-cookie';
import type { PostLoginContext } from './post-login-service';
import {
  resolveContextSelectionDestination,
  resolveDestinationFromContext,
  resolvePostLoginDestination,
} from './post-login-service';

vi.mock('../auth/transition-session', () => ({ getTransitionAuthorizationContext: vi.fn() }));
vi.mock('./operational-context-cookie', () => ({
  clearActiveOperationalContext: vi.fn(),
  getRequestedOperationalContext: vi.fn(),
  setOperationalContextCookie: vi.fn(),
}));

const mockedGetTransitionAuthorizationContext = vi.mocked(getTransitionAuthorizationContext);
const mockedClearActiveOperationalContext = vi.mocked(clearActiveOperationalContext);
const mockedSetOperationalContextCookie = vi.mocked(setOperationalContextCookie);

const readiness: OperationalReadiness = {
  personal_profile: { complete: true, missing_fields: [] },
  organization: { applicable: false, complete: false, missing_fields: [] },
  professional: { applicable: false, profile_complete: false, verification_status: null, operational: false, blockers: [], profiles: [] },
};
const completedProfile = {
  id: 'profile-1', userId: 'user-1', firstName: 'Aldo', lastName: 'Simone', phone: null,
  birthDate: null, taxCode: null, address: null, requestedAccountType: 'personal', accountTypeStatus: 'not_required', onboardingStatus: 'completed' as const,
} as const;
const personalContext: OperationalContext = {
  kind: 'personal_professional',
  professionalProfileId: '00000000-0000-4000-8000-000000000002',
  label: 'Studio Aldo Simone',
  professionalTypeCode: 'physician',
  professionalTypeDisplayName: 'Medico',
};
const organizationContext: OperationalContext = {
  kind: 'organization',
  organizationId: '00000000-0000-4000-8000-000000000003',
  membershipId: '00000000-0000-4000-8000-000000000004',
  label: 'Clinica Aurora',
  organizationTypeCode: 'clinic',
  organizationTypeDisplayName: 'Clinica',
  roles: [{ code: 'practitioner', displayName: 'Professionista' }],
};

function context(overrides: Partial<PostLoginContext> = {}): PostLoginContext {
  return {
    user: { id: 'user-1', email: 'user@example.com' }, profile: completedProfile,
    availableOperationalContexts: [], activeOperationalContext: null, platformRoles: [], operationalRoles: [],
    globalPermissions: [], operationalPermissions: [], permissions: [], readiness, ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedClearActiveOperationalContext.mockResolvedValue();
  mockedSetOperationalContextCookie.mockResolvedValue();
});

describe('resolveDestinationFromContext', () => {
  it('sends unauthenticated accounts to login', () => expect(resolveDestinationFromContext(context({ user: null }))).toBe('/login'));
  it('sends accounts without completed onboarding to onboarding', () => {
    expect(resolveDestinationFromContext(context({ profile: null }))).toBe('/onboarding');
    expect(resolveDestinationFromContext(context({ profile: { ...completedProfile, onboardingStatus: 'context_required' } }))).toBe('/onboarding');
  });
  it('sends accounts with zero contexts to dashboard setup', () => {
    expect(resolveDestinationFromContext(context())).toBe('/dashboard');
  });
  it('sends an account with one context to dashboard', () => {
    expect(resolveDestinationFromContext(context({ availableOperationalContexts: [personalContext], activeOperationalContext: personalContext }))).toBe('/dashboard');
  });
  it('requires explicit first selection when multiple contexts have no valid cookie', () => {
    expect(resolveDestinationFromContext(context({ availableOperationalContexts: [personalContext, organizationContext] }))).toBe('/seleziona-contesto');
  });
  it('uses a valid selected context when multiple contexts exist', () => {
    expect(resolveDestinationFromContext(context({ availableOperationalContexts: [personalContext, organizationContext], activeOperationalContext: organizationContext }))).toBe('/dashboard');
  });
});

describe('resolvePostLoginDestination', () => {
  it('clears the old context, requires selection, and preserves a safe invitation return path', async () => {
    mockedGetTransitionAuthorizationContext.mockResolvedValue(context({
      availableOperationalContexts: [personalContext, organizationContext],
      activeOperationalContext: organizationContext,
    }) as never);

    await expect(resolvePostLoginDestination('/inviti/accetta?token=token-123')).resolves.toBe(
      '/seleziona-contesto?next=%2Finviti%2Faccetta%3Ftoken%3Dtoken-123',
    );
    expect(mockedClearActiveOperationalContext).toHaveBeenCalledOnce();
    expect(mockedSetOperationalContextCookie).not.toHaveBeenCalled();
  });

  it('drops an unsafe return path before entering context selection', () => {
    expect(resolveContextSelectionDestination('https://attacker.example')).toBe('/seleziona-contesto');
  });
});
