import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseLike } from '../db/supabase';

export class CompanyInviteError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
  }
}

export type OrganizationInvitationRole = {
  id: string;
  code: string;
  displayName: string;
};

export type CompanyInviteRow = {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationInvitationRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

type InvitationRecord = {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by: string;
  accepted_at: string | null;
  revoked_at: string | null;
  roles: RoleRecord | RoleRecord[] | null;
};

type RoleRecord = {
  id: string;
  code: string;
  display_name: string;
  scope?: string;
  is_active?: boolean;
};

type RoleAssignmentRuleRecord = {
  target_role: RoleRecord | RoleRecord[] | null;
};

type CreateCompanyInvitePayload = {
  organizationId: string;
  inviterId: string;
  email: string;
  expiresInDays?: number;
};

type CreateCompanyInviteOptions = {
  tokenFactory?: () => string;
  now?: () => Date;
};

function buildCompanyAcceptLink(token: string): string {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const query = new URLSearchParams({ token });
  return `${base.replace(/\/$/, '')}/inviti/accetta?${query.toString()}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function makeToken(): string {
  return randomBytes(32).toString('base64url');
}

function oneRole(value: RoleRecord | RoleRecord[] | null): RoleRecord | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function invitationRoleDisplayName(role: RoleRecord): string {
  return role.code === 'practitioner' ? 'Medico' : role.display_name;
}

function toInvitationStatus(value: string): CompanyInviteRow['status'] {
  if (value === 'pending' || value === 'accepted' || value === 'revoked' || value === 'expired') return value;
  throw new CompanyInviteError('INVITATION_INVALID_STATUS', 500);
}

function normalizeRow(record: InvitationRecord): CompanyInviteRow {
  const role = oneRole(record.roles);
  if (!role) throw new CompanyInviteError('INVITATION_ROLE_NOT_CONFIGURED', 500);

  return {
    id: record.id,
    organizationId: record.organization_id,
    email: record.email,
    role: { id: role.id, code: role.code, displayName: invitationRoleDisplayName(role) },
    status: toInvitationStatus(record.status),
    expiresAt: record.expires_at,
    createdAt: record.created_at,
    invitedBy: record.invited_by,
    acceptedAt: record.accepted_at,
    revokedAt: record.revoked_at,
  };
}

function invitationFailure(record: InvitationRecord | null): never | InvitationRecord {
  if (!record) throw new CompanyInviteError('INVITATION_NOT_FOUND', 404);
  if (record.status === 'revoked') throw new CompanyInviteError('INVITATION_REVOKED', 422);
  if (record.status === 'accepted') throw new CompanyInviteError('INVITATION_ALREADY_ACCEPTED', 409);
  if (record.status === 'expired' || new Date(record.expires_at).getTime() <= Date.now()) {
    throw new CompanyInviteError('INVITATION_EXPIRED', 422);
  }
  if (record.status !== 'pending') throw new CompanyInviteError('INVITATION_NOT_FOUND', 404);
  return record;
}

async function getOrganizationName(db: SupabaseLike, organizationId: string): Promise<string> {
  const { data, error } = await db
    .from('organizations')
    .select('display_name,status')
    .eq('id', organizationId)
    .maybeSingle();
  const organization = data as unknown as { display_name?: string; status?: string } | null;
  if (error || !organization || organization.status !== 'active') {
    throw new CompanyInviteError('INVITATION_ORGANIZATION_NOT_ACTIVE', 422);
  }
  return organization.display_name?.trim() || 'l’organizzazione';
}

async function getInviteByToken(db: SupabaseLike, token: string): Promise<InvitationRecord> {
  if (!token) throw new CompanyInviteError('INVITATION_NOT_FOUND', 404);
  const { data, error } = await db
    .from('invitations')
    .select('id,organization_id,email,role_id,status,expires_at,created_at,invited_by,accepted_at,revoked_at,roles(id,code,display_name)')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw new CompanyInviteError('INVITATION_LOOKUP_FAILED', 500);
  return invitationFailure(data as unknown as InvitationRecord | null);
}

async function getActiveMembershipRoleIds(
  db: SupabaseLike,
  organizationId: string,
  userId: string,
): Promise<string[]> {
  const { data: membershipData, error: membershipError } = await db
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  const membership = membershipData as unknown as { id?: string } | null;
  if (membershipError || !membership?.id) throw new CompanyInviteError('FORBIDDEN', 403);

  const { data: assignmentsData, error: assignmentsError } = await db
    .from('member_roles')
    .select('role_id')
    .eq('organization_member_id', membership.id);
  if (assignmentsError) throw new CompanyInviteError('INVITATION_ROLE_LOOKUP_FAILED', 500);

  return Array.from(new Set(
    ((assignmentsData ?? []) as unknown as Array<{ role_id?: string }>)
      .map((assignment) => assignment.role_id)
      .filter((roleId): roleId is string => Boolean(roleId)),
  ));
}

export async function listAssignableOrganizationInvitationRoles(
  db: SupabaseLike,
  organizationId: string,
  inviterId: string,
): Promise<OrganizationInvitationRole[]> {
  const assignerRoleIds = await getActiveMembershipRoleIds(db, organizationId, inviterId);
  if (assignerRoleIds.length === 0) return [];

  const { data, error } = await db
    .from('organization_role_assignment_rules')
    .select('target_role:roles!organization_role_assignment_rules_target_role_id_fkey(id,code,display_name,scope,is_active)')
    .in('assigner_role_id', assignerRoleIds);
  if (error) throw new CompanyInviteError('INVITATION_ROLE_LOOKUP_FAILED', 500);

  const rolesById = new Map<string, OrganizationInvitationRole>();
  for (const rule of (data ?? []) as unknown as RoleAssignmentRuleRecord[]) {
    const role = oneRole(rule.target_role);
    if (!role || role.scope !== 'organization' || role.is_active === false) continue;
    rolesById.set(role.id, { id: role.id, code: role.code, displayName: invitationRoleDisplayName(role) });
  }

  return [...rolesById.values()].sort((left, right) => left.displayName.localeCompare(right.displayName, 'it'));
}

async function getMedicalPractitionerRole(db: SupabaseLike): Promise<OrganizationInvitationRole> {
  const { data, error } = await db
    .from('roles')
    .select('id,code,display_name,scope,is_active')
    .eq('code', 'practitioner')
    .eq('scope', 'organization')
    .eq('is_active', true)
    .maybeSingle();
  const role = data as unknown as RoleRecord | null;
  if (error || !role) throw new CompanyInviteError('INVITATION_MEDICAL_ROLE_NOT_CONFIGURED', 500);
  return { id: role.id, code: role.code, displayName: invitationRoleDisplayName(role) };
}

async function expirePendingCompanyInvites(
  db: SupabaseLike,
  organizationId: string,
  now: Date,
  email?: string,
): Promise<void> {
  let query = db
    .from('invitations')
    .update({ status: 'expired' })
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .lte('expires_at', now.toISOString());
  if (email) query = query.ilike('email', email);

  const { error } = await query;
  if (error) throw new CompanyInviteError('INVITATION_EXPIRY_UPDATE_FAILED', 500);
}

export async function lookupCompanyInvite(db: SupabaseLike, token: string) {
  const invite = normalizeRow(await getInviteByToken(db, token));
  return {
    organizationName: await getOrganizationName(db, invite.organizationId),
    role: invite.role.displayName,
    expiresAt: invite.expiresAt,
    status: 'pending' as const,
  };
}

export async function acceptCompanyInvite(db: SupabaseLike, token: string, userId: string) {
  if (!token || !userId) throw new CompanyInviteError('INVITATION_NOT_FOUND', 404);
  const { data, error } = await db.rpc('accept_organization_invitation', {
    p_token_hash: hashToken(token),
    p_user_id: userId,
  });

  if (error) {
    const message = error.message ?? '';
    const mappedCodes: Array<[string, string, number]> = [
      ['INVITATION_NOT_FOUND', 'INVITATION_NOT_FOUND', 404],
      ['INVITATION_EMAIL_MISMATCH', 'INVITATION_EMAIL_MISMATCH', 403],
      ['INVITATION_EXPIRED', 'INVITATION_EXPIRED', 422],
      ['INVITATION_REVOKED', 'INVITATION_REVOKED', 422],
      ['INVITATION_ALREADY_ACCEPTED', 'INVITATION_ALREADY_ACCEPTED', 409],
      ['MEMBERSHIP_ALREADY_EXISTS', 'MEMBERSHIP_ALREADY_EXISTS', 409],
      ['MEMBERSHIP_NOT_ACTIVE', 'MEMBERSHIP_NOT_ACTIVE', 409],
      ['INVITATION_ORGANIZATION_NOT_ACTIVE', 'FORBIDDEN', 403],
      ['INVITATION_ROLE_NOT_MEDICAL', 'INVITATION_ROLE_NOT_MEDICAL', 422],
      ['INVITATION_RECIPIENT_NOT_PHYSICIAN', 'INVITATION_RECIPIENT_NOT_PHYSICIAN', 422],
    ];
    const mapped = mappedCodes.find(([source]) => message.includes(source));
    if (mapped) throw new CompanyInviteError(mapped[1], mapped[2]);
    throw new CompanyInviteError('INVITATION_ACCEPT_FAILED', 500);
  }

  const result = data as unknown as { organization_id?: string; role_code?: string; already_member?: boolean; membership_reactivated?: boolean } | null;
  if (!result?.organization_id || !result.role_code) throw new CompanyInviteError('INVITATION_ROLE_NOT_CONFIGURED', 500);
  return {
    organizationId: result.organization_id,
    roleCode: result.role_code,
    alreadyMember: Boolean(result.already_member),
    membershipReactivated: Boolean(result.membership_reactivated),
  };
}

export async function createCompanyInvite(
  db: SupabaseLike,
  payload: CreateCompanyInvitePayload,
  options: CreateCompanyInviteOptions = {},
): Promise<{ invitation: CompanyInviteRow; acceptLink: string }> {
  await getOrganizationName(db, payload.organizationId);
  const medicalPractitionerRole = await getMedicalPractitionerRole(db);
  const assignableRoles = await listAssignableOrganizationInvitationRoles(db, payload.organizationId, payload.inviterId);
  const role = assignableRoles.find((candidate) => candidate.id === medicalPractitionerRole.id);
  if (!role) throw new CompanyInviteError('INVITATION_ROLE_NOT_ASSIGNABLE', 403);

  const email = payload.email.trim().toLowerCase();
  const now = options.now?.() ?? new Date();
  await expirePendingCompanyInvites(db, payload.organizationId, now, email);
  const { data: pendingInvite, error: pendingInviteError } = await db
    .from('invitations')
    .select('id')
    .eq('organization_id', payload.organizationId)
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle();
  if (pendingInviteError) throw new CompanyInviteError('INVITATION_LOOKUP_FAILED', 500);
  if (pendingInvite) throw new CompanyInviteError('INVITATION_ALREADY_PENDING', 409);

  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (payload.expiresInDays ?? 7));
  const rawToken = options.tokenFactory?.() ?? makeToken();

  const { data, error } = await db
    .from('invitations')
    .insert({
      organization_id: payload.organizationId,
      email,
      role_id: role.id,
      invited_by: payload.inviterId,
      token_hash: hashToken(rawToken),
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select('id,organization_id,email,role_id,status,expires_at,created_at,invited_by,accepted_at,revoked_at,roles(id,code,display_name)')
    .single();
  if (error || !data) {
    if (error?.code === '23505') throw new CompanyInviteError('INVITATION_ALREADY_PENDING', 409);
    throw new CompanyInviteError('INVITATION_CREATE_FAILED', 500);
  }

  const invitation = normalizeRow(data as unknown as InvitationRecord);
  const { data: auditData, error: auditError } = await db.from('audit_events').insert({
    actor_user_id: payload.inviterId,
    organization_id: payload.organizationId,
    action: 'organization.invitation.created',
    resource_type: 'invitation',
    resource_id: invitation.id,
    metadata: { roleCode: invitation.role.code },
  });
  void auditData;
  if (auditError) throw new CompanyInviteError('INVITATION_AUDIT_FAILED', 500);

  return { invitation, acceptLink: buildCompanyAcceptLink(rawToken) };
}

export async function listCompanyInvites(
  db: SupabaseLike,
  organizationId: string,
  pagination: { page: number; limit: number },
): Promise<{ data: CompanyInviteRow[]; total: number; page: number; limit: number; pages: number }> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  await expirePendingCompanyInvites(db, organizationId, new Date());
  const { data, count, error } = await db
    .from('invitations')
    .select('id,organization_id,email,role_id,status,expires_at,created_at,invited_by,accepted_at,revoked_at,roles(id,code,display_name)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('hidden_from_history_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new CompanyInviteError('INVITATION_LIST_FAILED', 500);

  return {
    data: (data ?? []).map((record: unknown) => normalizeRow(record as InvitationRecord)),
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  };
}

export async function revokeCompanyInvite(
  db: SupabaseLike,
  inviteId: string,
  organizationId: string,
  actorUserId: string,
): Promise<void> {
  const { data, error: lookupError } = await db
    .from('invitations')
    .select('id,status')
    .eq('id', inviteId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  const invite = data as unknown as { id?: string; status?: string } | null;
  if (lookupError) throw new CompanyInviteError('INVITATION_LOOKUP_FAILED', 500);
  if (!invite?.id) throw new CompanyInviteError('INVITATION_NOT_FOUND', 404);
  if (invite.status !== 'pending') throw new CompanyInviteError('INVITATION_NOT_PENDING', 422);

  const { error } = await db
    .from('invitations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', invite.id)
    .eq('organization_id', organizationId);
  if (error) throw new CompanyInviteError('INVITATION_REVOKE_FAILED', 500);

  const { error: auditError } = await db.from('audit_events').insert({
    actor_user_id: actorUserId,
    organization_id: organizationId,
    action: 'organization.invitation.revoked',
    resource_type: 'invitation',
    resource_id: invite.id,
    metadata: {},
  });
  if (auditError) throw new CompanyInviteError('INVITATION_AUDIT_FAILED', 500);
}

export async function hideCompanyInviteFromHistory(
  db: SupabaseLike,
  inviteId: string,
  organizationId: string,
  actorUserId: string,
): Promise<void> {
  const { error } = await db.rpc('hide_organization_invitation_from_history', {
    p_organization_id: organizationId,
    p_invitation_id: inviteId,
    p_actor_user_id: actorUserId,
  });
  if (!error) return;

  const message = error.message ?? '';
  if (message.includes('INVITATION_NOT_FOUND')) throw new CompanyInviteError('INVITATION_NOT_FOUND', 404);
  if (message.includes('INVITATION_PENDING_HISTORY_HIDE_NOT_ALLOWED')) {
    throw new CompanyInviteError('INVITATION_PENDING_HISTORY_HIDE_NOT_ALLOWED', 422);
  }
  throw new CompanyInviteError('INVITATION_HISTORY_HIDE_FAILED', 500);
}

export async function clearCompanyInviteHistory(
  db: SupabaseLike,
  organizationId: string,
  actorUserId: string,
): Promise<{ hiddenCount: number }> {
  const { data, error } = await db.rpc('clear_organization_invitation_history', {
    p_organization_id: organizationId,
    p_actor_user_id: actorUserId,
  });
  if (error) throw new CompanyInviteError('INVITATION_HISTORY_CLEAR_FAILED', 500);

  const hiddenCount = typeof data === 'number' ? data : Number(data);
  if (!Number.isInteger(hiddenCount) || hiddenCount < 0) {
    throw new CompanyInviteError('INVITATION_HISTORY_CLEAR_FAILED', 500);
  }
  return { hiddenCount };
}

export async function resendCompanyInvite(
  db: SupabaseLike,
  inviteId: string,
  organizationId: string,
  actorUserId: string,
): Promise<{ acceptLink: string }> {
  const { data, error } = await db
    .from('invitations')
    .select('id,organization_id,email,role_id,status,expires_at,created_at,invited_by,accepted_at,revoked_at,roles(id,code,display_name)')
    .eq('id', inviteId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new CompanyInviteError('INVITATION_LOOKUP_FAILED', 500);
  const invite = invitationFailure(data as unknown as InvitationRecord | null);

  const rawToken = makeToken();
  const { error: updateError } = await db
    .from('invitations')
    .update({ token_hash: hashToken(rawToken), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
    .eq('id', invite.id)
    .eq('organization_id', organizationId);
  if (updateError) throw new CompanyInviteError('INVITATION_RESEND_FAILED', 500);

  const { error: auditError } = await db.from('audit_events').insert({
    actor_user_id: actorUserId,
    organization_id: organizationId,
    action: 'organization.invitation.link_rotated',
    resource_type: 'invitation',
    resource_id: invite.id,
    metadata: {},
  });
  if (auditError) throw new CompanyInviteError('INVITATION_AUDIT_FAILED', 500);

  return { acceptLink: buildCompanyAcceptLink(rawToken) };
}
