import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/authorization-context-service', () => ({
  getAuthorizationContext: vi.fn(),
}));

import { getAuthorizationContext } from '../../services/authorization-context-service';
import { getCurrentOrganizationProfile } from '../../services/organization-profile-service';

const mockedGetAuthorizationContext = vi.mocked(getAuthorizationContext);

describe('organization profile service security', () => {
  it('does not accept an organization identifier without an active authorized membership context', async () => {
    mockedGetAuthorizationContext.mockResolvedValue({
      activeOrganization: null,
      organizationPermissions: [],
    } as never);
    const db = { from: vi.fn() };

    await expect(getCurrentOrganizationProfile(
      db,
      { id: 'verified-user', email: 'user@example.com', tipo_utente: 'privato' },
      '4a7f0a3d-42c0-4384-a0b6-c5b3553f950b',
    )).rejects.toMatchObject({ code: 'ORGANIZATION_NOT_FOUND', status: 404 });

    expect(mockedGetAuthorizationContext).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: 'verified-user' }),
      { requestedOrganizationId: '4a7f0a3d-42c0-4384-a0b6-c5b3553f950b' },
    );
    expect(db.from).not.toHaveBeenCalled();
  });
});
