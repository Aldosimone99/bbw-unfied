import { describe, expect, it, vi } from 'vitest';
import { getAuthorizationContext } from '../../services/authorization-context-service';

function query(result: unknown, error: unknown = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: result, error }),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve({ data: result, error }),
  };
  return builder;
}

describe('getAuthorizationContext', () => {
  it('derives permissions only from the verified user and backend memberships', async () => {
    const userQuery = query({
      id: 'user-1',
      email: 'owner@example.com',
      tipo_utente: 'privato',
      nome: 'Mario',
      cognome: 'Rossi',
      telefono: null,
      requested_account_type: 'organization',
      onboarding_status: 'completed',
    });
    const membershipQuery = query([
      {
        id: 'membership-1',
        role: 'owner',
        is_active: true,
        created_at: '2026-08-11T10:00:00.000Z',
        companies: { id: 'company-1', name: 'Clinica BBW', clinic_display_name: null },
      },
    ]);
    const db = { from: vi.fn((table: string) => table === 'users' ? userQuery : membershipQuery) };

    const context = await getAuthorizationContext(db, {
      id: 'user-1',
      email: 'owner@example.com',
      tipo_utente: 'privato',
    });

    expect(context.user.id).toBe('user-1');
    expect(context.activeOrganization?.organizationId).toBe('company-1');
    expect(context.permissions).toEqual(expect.arrayContaining([
      'dashboard.access',
      'organization.members.manage',
      'profile.update_own',
    ]));
    expect(context.permissions).not.toContain('platform.admin.access');
  });

  it('does not expose a membership returned for another user', async () => {
    const userQuery = query({
      id: 'user-2', email: 'user2@example.com', tipo_utente: 'privato', nome: null, cognome: null,
      requested_account_type: null, onboarding_status: 'profile_required',
    });
    const membershipQuery = query([]);
    const db = { from: vi.fn((table: string) => table === 'users' ? userQuery : membershipQuery) };

    const context = await getAuthorizationContext(db, {
      id: 'user-2', email: 'user2@example.com', tipo_utente: 'privato',
    });

    expect(context.memberships).toEqual([]);
    expect(context.activeOrganization).toBeNull();
    expect(context.permissions).not.toContain('organization.members.manage');
  });
});
