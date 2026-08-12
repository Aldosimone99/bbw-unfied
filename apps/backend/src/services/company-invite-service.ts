import { createHash, randomBytes } from 'node:crypto';
import type { CompanyInviteTargetRole } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import type { EmailService } from './email-service';

export class CompanyInviteError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
  }
}

export type CompanyInviteRow = {
  id: string;
  company_id: string;
  email: string;
  nome?: string | null;
  cognome?: string | null;
  role: string;
  role_id?: string;
  status: string;
  expires_at?: string | null;
  created_at?: string;
  invited_by?: string | null;
  accepted_by?: string | null;
  user_id?: string | null;
};

const targetRoleToCanonicalRole: Record<CompanyInviteTargetRole, string> = {
  medico: 'practitioner',
  estetista: 'practitioner',
  cliente: 'customer',
  admin: 'organization_admin',
  staff: 'staff',
};

const canonicalRoleToTargetRole: Record<string, CompanyInviteTargetRole> = {
  practitioner: 'medico',
  customer: 'cliente',
  organization_admin: 'admin',
  staff: 'staff',
};

const allowedInviteTargets: Record<string, CompanyInviteTargetRole[]> = {
  organization_owner: ['admin', 'staff', 'medico', 'estetista', 'cliente'],
  organization_admin: ['staff', 'medico', 'estetista', 'cliente'],
  office_manager: ['medico', 'estetista', 'cliente'],
};

export function membershipRole(role: string): string {
  return role;
}

type CreateCompanyInvitePayload = {
  companyId: string;
  inviterId: string;
  inviterCompanyRole: string;
  email: string;
  role: CompanyInviteTargetRole;
  nome?: string;
  cognome?: string;
  expiresInDays?: number;
};

type CreateCompanyInviteOptions = {
  tokenFactory?: () => string;
  now?: () => Date;
  messagingService?: unknown;
};

type AcceptCompanyInviteOptions = { messagingService?: unknown };

function buildCompanyAcceptLink(token: string): string {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/company/invite/accept/${token}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function makeToken(): string {
  return randomBytes(32).toString('base64url');
}

function assertCanInvite(inviterCompanyRole: string, targetRole: CompanyInviteTargetRole) {
  if (!allowedInviteTargets[inviterCompanyRole]?.includes(targetRole)) {
    throw new CompanyInviteError('COMPANY_INVITE_FORBIDDEN', 403);
  }
}

function toTargetRole(roleCode: string | null | undefined): CompanyInviteTargetRole {
  return canonicalRoleToTargetRole[roleCode ?? ''] ?? 'staff';
}

function normalizeRow(row: any): CompanyInviteRow {
  const roleCode = row.roles?.code ?? row.role?.code ?? null;
  return {
    id: row.id,
    company_id: row.organization_id,
    email: row.email,
    nome: row.invitee_first_name ?? null,
    cognome: row.invitee_last_name ?? null,
    role: toTargetRole(roleCode),
    role_id: row.role_id,
    status: row.status,
    expires_at: row.expires_at ?? null,
    created_at: row.created_at,
    invited_by: row.invited_by ?? null,
    accepted_by: row.accepted_by ?? null,
  };
}

function assertUsable(row: any | null): any {
  if (!row) throw new CompanyInviteError('COMPANY_INVITE_NOT_FOUND', 404);
  if (row.status === 'accepted') return row;
  if (row.status !== 'pending') throw new CompanyInviteError('COMPANY_INVITE_NOT_PENDING', 422);
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    throw new CompanyInviteError('COMPANY_INVITE_EXPIRED', 422);
  }
  return row;
}

async function getOrganizationName(db: SupabaseLike, organizationId: string): Promise<string> {
  const { data } = await db
    .from('organizations')
    .select('display_name')
    .eq('id', organizationId)
    .maybeSingle();
  return String((data as { display_name?: string } | null)?.display_name ?? 'l’organizzazione');
}

async function getRoleId(db: SupabaseLike, roleCode: string): Promise<string> {
  const { data, error } = await db
    .from('roles')
    .select('id')
    .eq('code', roleCode)
    .eq('scope', 'organization')
    .eq('is_active', true)
    .single();
  if (error || !data?.id) throw new CompanyInviteError('COMPANY_INVITE_ROLE_NOT_CONFIGURED', 500);
  return String(data.id);
}

async function getInviteByToken(db: SupabaseLike, token: string) {
  if (!token) throw new CompanyInviteError('COMPANY_INVITE_NOT_FOUND', 404);
  const { data, error } = await db
    .from('invitations')
    .select('*, roles(id,code,display_name)')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw new CompanyInviteError('COMPANY_INVITE_LOOKUP_FAILED', 500);
  return assertUsable(data as any | null);
}

export async function lookupCompanyInvite(db: SupabaseLike, token: string) {
  const invite = await getInviteByToken(db, token);
  const normalized = normalizeRow(invite);
  return {
    email: normalized.email,
    nome: normalized.nome ?? null,
    cognome: normalized.cognome ?? null,
    role: normalized.role,
    companyId: normalized.company_id,
    companyName: await getOrganizationName(db, normalized.company_id),
    expiresAt: normalized.expires_at ?? null,
    userId: normalized.accepted_by ?? null,
    status: normalized.status === 'accepted' ? 'accepted' as const : 'pending' as const,
  };
}

export async function acceptCompanyInvite(
  db: SupabaseLike,
  token: string,
  userId: string,
  _options: AcceptCompanyInviteOptions = {},
) {
  if (!token || !userId) throw new CompanyInviteError('COMPANY_INVITE_NOT_FOUND', 404);
  const { data, error } = await db.rpc('accept_organization_invitation', {
    p_token_hash: hashToken(token),
    p_user_id: userId,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('INVITATION_NOT_FOUND')) throw new CompanyInviteError('COMPANY_INVITE_NOT_FOUND', 404);
    if (message.includes('INVITATION_EMAIL_MISMATCH')) throw new CompanyInviteError('COMPANY_INVITE_EMAIL_MISMATCH', 403);
    if (message.includes('INVITATION_EXPIRED')) throw new CompanyInviteError('COMPANY_INVITE_EXPIRED', 422);
    if (message.includes('INVITATION_NOT_PENDING') || message.includes('INVITATION_ALREADY_ACCEPTED')) {
      throw new CompanyInviteError('COMPANY_INVITE_NOT_PENDING', 422);
    }
    throw new CompanyInviteError('COMPANY_INVITE_ACCEPT_FAILED', 500);
  }

  const roleCode = String(data?.role_code ?? '');
  if (!roleCode) throw new CompanyInviteError('COMPANY_INVITE_ROLE_NOT_CONFIGURED', 500);
  return {
    companyId: String(data.organization_id),
    role: toTargetRole(roleCode),
    membershipRole: membershipRole(roleCode),
    alreadyMember: Boolean(data.already_member),
  };
}

export async function createCompanyInvite(
  db: SupabaseLike,
  payload: CreateCompanyInvitePayload,
  emailService: EmailService,
  options: CreateCompanyInviteOptions = {},
): Promise<{ invite: CompanyInviteRow; acceptLink: string }> {
  assertCanInvite(payload.inviterCompanyRole, payload.role);

  const { data: organization, error: organizationError } = await db
    .from('organizations')
    .select('id,status')
    .eq('id', payload.companyId)
    .maybeSingle();
  if (organizationError || !organization || organization.status !== 'active') {
    throw new CompanyInviteError('COMPANY_NOT_FOUND', 404);
  }

  const roleId = await getRoleId(db, targetRoleToCanonicalRole[payload.role]);
  const email = payload.email.trim().toLowerCase();
  const { data: pendingInvite } = await db
    .from('invitations')
    .select('id')
    .eq('organization_id', payload.companyId)
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle();
  if (pendingInvite) throw new CompanyInviteError('INVITE_ALREADY_PENDING', 409);

  const now = options.now?.() ?? new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (payload.expiresInDays ?? 7));
  const rawToken = options.tokenFactory?.() ?? makeToken();

  const { data, error } = await db
    .from('invitations')
    .insert({
      organization_id: payload.companyId,
      email,
      role_id: roleId,
      invited_by: payload.inviterId,
      token_hash: hashToken(rawToken),
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      invitee_first_name: payload.nome ?? null,
      invitee_last_name: payload.cognome ?? null,
    })
    .select('*, roles(id,code,display_name)')
    .single();
  if (error || !data) {
    if (error?.code === '23505') throw new CompanyInviteError('INVITE_ALREADY_PENDING', 409);
    throw new CompanyInviteError('COMPANY_INVITE_CREATE_FAILED', 500);
  }

  const invite = normalizeRow(data);
  const acceptLink = buildCompanyAcceptLink(rawToken);
  await emailService.sendCompanyInviteEmail({
    to: invite.email,
    nome: invite.nome,
    clinicName: await getOrganizationName(db, payload.companyId),
    role: payload.role,
    acceptLink,
  });

  await db.from('audit_events').insert({
    actor_user_id: payload.inviterId,
    organization_id: payload.companyId,
    action: 'organization.invitation.created',
    resource_type: 'invitation',
    resource_id: invite.id,
    metadata: { targetRole: payload.role },
  });

  return { invite, acceptLink };
}

export async function listCompanyInvites(
  db: SupabaseLike,
  companyId: string,
  pagination: { page: number; limit: number },
): Promise<{ data: (CompanyInviteRow & { acceptLink?: string })[]; total: number; page: number; limit: number; pages: number }> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await db
    .from('invitations')
    .select('*, roles(id,code,display_name)', { count: 'exact' })
    .eq('organization_id', companyId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new CompanyInviteError('COMPANY_INVITE_LIST_FAILED', 500);

  return {
    data: ((data ?? []) as any[]).map(normalizeRow),
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  };
}

export async function revokeCompanyInvite(db: SupabaseLike, inviteId: string, companyId: string): Promise<void> {
  const { data } = await db
    .from('invitations')
    .select('id,status')
    .eq('id', inviteId)
    .eq('organization_id', companyId)
    .maybeSingle();
  if (!data) throw new CompanyInviteError('COMPANY_INVITE_NOT_FOUND', 404);
  if (data.status !== 'pending') throw new CompanyInviteError('COMPANY_INVITE_NOT_PENDING', 422);
  const { error } = await db.from('invitations').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', inviteId);
  if (error) throw new CompanyInviteError('COMPANY_INVITE_REVOKE_FAILED', 500);
}

export async function resendCompanyInvite(
  db: SupabaseLike,
  inviteId: string,
  companyId: string,
  emailService: EmailService,
): Promise<{ acceptLink: string }> {
  const { data, error } = await db
    .from('invitations')
    .select('*, roles(id,code,display_name)')
    .eq('id', inviteId)
    .eq('organization_id', companyId)
    .maybeSingle();
  if (error) throw new CompanyInviteError('COMPANY_INVITE_LOOKUP_FAILED', 500);
  const invite = assertUsable(data as any | null);
  // A resend cannot reconstruct the original raw token because only its hash is stored.
  // Rotate it, so a leaked old link is invalidated and the new link is the only usable one.
  const rawToken = makeToken();
  const { error: updateError } = await db.from('invitations').update({ token_hash: hashToken(rawToken), expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }).eq('id', invite.id);
  if (updateError) throw new CompanyInviteError('COMPANY_INVITE_RESEND_FAILED', 500);
  const normalized = normalizeRow(invite);
  const acceptLink = buildCompanyAcceptLink(rawToken);
  await emailService.sendCompanyInviteEmail({
    to: normalized.email,
    nome: normalized.nome,
    clinicName: await getOrganizationName(db, companyId),
    role: normalized.role,
    acceptLink,
  });
  return { acceptLink };
}
