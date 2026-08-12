import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OperationalReadiness } from '@bbw/interfaces';
import { getCurrentProfile, getCurrentUser } from './current-user';
import { getTransitionAuthorizationContext } from './transition-session';

vi.mock('./transition-session', () => ({ getTransitionAuthorizationContext: vi.fn() }));

const mockedGetAuthorizationContext = vi.mocked(getTransitionAuthorizationContext);
const readiness: OperationalReadiness = {
  personal_profile: { complete: false, missing_fields: ['birth_date', 'tax_code', 'address'] },
  organization: { applicable: false, complete: false, missing_fields: [] },
  professional: { applicable: false, profile_complete: false, verification_status: null, operational: false, blockers: [], profiles: [] },
};
const profile = {
  id: 'user-1', userId: 'user-1', firstName: null, lastName: null, phone: null,
  birthDate: null, taxCode: null, address: null, requestedAccountType: null,
  operationalRole: null, accountTypeStatus: 'not_required' as const, onboardingStatus: 'profile_required' as const,
};
const authorizationContext = {
  user: { id: 'user-1', email: 'person@example.test', tipo_utente: 'privato' as const },
  profile, availableOperationalContexts: [], activeOperationalContext: null, platformRoles: [], operationalRoles: [],
  globalPermissions: [], operationalPermissions: [], permissions: [], readiness,
};

describe('current user', () => {
  beforeEach(() => vi.resetAllMocks());

  it('reads identity and profile from the canonical authorization context', async () => {
    mockedGetAuthorizationContext.mockResolvedValue(authorizationContext);
    await expect(getCurrentUser()).resolves.toEqual({ id: 'user-1', email: 'person@example.test' });
    await expect(getCurrentProfile()).resolves.toEqual(profile);
  });

  it('returns null when the backend cannot establish an authorized session', async () => {
    mockedGetAuthorizationContext.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(getCurrentProfile()).resolves.toBeNull();
  });
});
