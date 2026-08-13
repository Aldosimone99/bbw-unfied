import { describe, expect, it, vi } from 'vitest';
import type { SupabaseLike } from '../../db/supabase';
import {
  listOrganizationMembers,
  removeOrganizationMember,
} from '../../services/organization-members-service';

const organizationId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const actorUserId = '33333333-3333-4333-8333-333333333333';

describe('organization members service', () => {
  it('lists normalized members only through the organization-scoped RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        membership_id: membershipId,
        user_id: '44444444-4444-4444-8444-444444444444',
        email: 'doctor@example.com',
        first_name: 'Mario',
        last_name: 'Rossi',
        status: 'active',
        joined_at: '2026-08-12T10:00:00.000Z',
        roles: [{ code: 'practitioner', displayName: 'Professionista' }],
        is_organization_owner: false,
      }],
      error: null,
    });

    await expect(listOrganizationMembers({ rpc } as unknown as SupabaseLike, organizationId)).resolves.toEqual([{
      membershipId,
      userId: '44444444-4444-4444-8444-444444444444',
      email: 'doctor@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      status: 'active',
      joinedAt: '2026-08-12T10:00:00.000Z',
      roles: [{ code: 'practitioner', displayName: 'Professionista' }],
      isOrganizationOwner: false,
    }]);
    expect(rpc).toHaveBeenCalledWith('list_organization_members', { p_organization_id: organizationId });
  });

  it.each([
    ['ORGANIZATION_MEMBER_NOT_FOUND', 'ORGANIZATION_MEMBER_NOT_FOUND', 404],
    ['ORGANIZATION_MEMBER_SELF_REMOVAL_NOT_ALLOWED', 'ORGANIZATION_MEMBER_SELF_REMOVAL_NOT_ALLOWED', 403],
    ['ORGANIZATION_LAST_OWNER_REMOVAL_NOT_ALLOWED', 'ORGANIZATION_LAST_OWNER_REMOVAL_NOT_ALLOWED', 409],
    ['ORGANIZATION_MEMBER_NOT_ACTIVE', 'ORGANIZATION_MEMBER_NOT_ACTIVE', 409],
  ])('maps protected removal failure %s', async (databaseError, code, status) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: databaseError } });

    await expect(removeOrganizationMember(
      { rpc } as unknown as SupabaseLike,
      organizationId,
      membershipId,
      actorUserId,
    )).rejects.toMatchObject({ code, status });
    expect(rpc).toHaveBeenCalledWith('remove_organization_member', {
      p_organization_id: organizationId,
      p_membership_id: membershipId,
      p_actor_user_id: actorUserId,
    });
  });

  it('returns the revoked membership state from the atomic removal RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { membership_id: membershipId, status: 'revoked' },
      error: null,
    });

    await expect(removeOrganizationMember(
      { rpc } as unknown as SupabaseLike,
      organizationId,
      membershipId,
      actorUserId,
    )).resolves.toEqual({ membershipId, status: 'revoked' });
  });
});
