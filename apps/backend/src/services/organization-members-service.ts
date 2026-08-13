import type { SupabaseLike } from '../db/supabase';

export class OrganizationMembersError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
  }
}

export type OrganizationMemberRole = {
  code: string;
  displayName: string;
};

export type OrganizationMember = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  joinedAt: string | null;
  roles: OrganizationMemberRole[];
  isOrganizationOwner: boolean;
};

type OrganizationMemberRpcRow = {
  membership_id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  joined_at: string | null;
  roles: unknown;
  is_organization_owner: boolean;
};

function toMembershipStatus(value: string): OrganizationMember['status'] {
  if (value === 'pending' || value === 'active' || value === 'suspended' || value === 'revoked') return value;
  throw new OrganizationMembersError('ORGANIZATION_MEMBER_INVALID_STATUS', 500);
}

function normalizeRoles(value: unknown): OrganizationMemberRole[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((role): OrganizationMemberRole[] => {
    if (!role || typeof role !== 'object') return [];
    const code = (role as { code?: unknown }).code;
    const displayName = (role as { displayName?: unknown }).displayName;
    return typeof code === 'string' && typeof displayName === 'string'
      ? [{ code, displayName }]
      : [];
  });
}

function normalizeMember(row: OrganizationMemberRpcRow): OrganizationMember {
  return {
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    status: toMembershipStatus(row.status),
    joinedAt: row.joined_at,
    roles: normalizeRoles(row.roles),
    isOrganizationOwner: row.is_organization_owner,
  };
}

export async function listOrganizationMembers(
  db: SupabaseLike,
  organizationId: string,
): Promise<OrganizationMember[]> {
  const { data, error } = await db.rpc('list_organization_members', {
    p_organization_id: organizationId,
  });
  if (error) throw new OrganizationMembersError('ORGANIZATION_MEMBER_LIST_FAILED', 500);
  return ((data ?? []) as unknown as OrganizationMemberRpcRow[]).map(normalizeMember);
}

export async function removeOrganizationMember(
  db: SupabaseLike,
  organizationId: string,
  membershipId: string,
  actorUserId: string,
): Promise<{ membershipId: string; status: 'revoked' }> {
  const { data, error } = await db.rpc('remove_organization_member', {
    p_organization_id: organizationId,
    p_membership_id: membershipId,
    p_actor_user_id: actorUserId,
  });
  if (error) {
    const message = error.message ?? '';
    const mappedCodes: Array<[string, string, number]> = [
      ['ORGANIZATION_MEMBER_NOT_FOUND', 'ORGANIZATION_MEMBER_NOT_FOUND', 404],
      ['ORGANIZATION_MEMBER_SELF_REMOVAL_NOT_ALLOWED', 'ORGANIZATION_MEMBER_SELF_REMOVAL_NOT_ALLOWED', 403],
      ['ORGANIZATION_LAST_OWNER_REMOVAL_NOT_ALLOWED', 'ORGANIZATION_LAST_OWNER_REMOVAL_NOT_ALLOWED', 409],
      ['ORGANIZATION_MEMBER_NOT_ACTIVE', 'ORGANIZATION_MEMBER_NOT_ACTIVE', 409],
    ];
    const mapped = mappedCodes.find(([source]) => message.includes(source));
    if (mapped) throw new OrganizationMembersError(mapped[1], mapped[2]);
    throw new OrganizationMembersError('ORGANIZATION_MEMBER_REMOVE_FAILED', 500);
  }

  const result = data as unknown as { membership_id?: string; status?: string } | null;
  if (!result?.membership_id || result.status !== 'revoked') {
    throw new OrganizationMembersError('ORGANIZATION_MEMBER_REMOVE_FAILED', 500);
  }
  return { membershipId: result.membership_id, status: 'revoked' };
}
