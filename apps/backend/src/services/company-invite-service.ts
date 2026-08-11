import type { CompanyInviteTargetRole } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import type { EmailService } from './email-service';
import {
  getOrCreateNotificationThread,
  insertSystemMessage,
} from './messaging-service';

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
  status: string;
  accept_token?: string | null;
  expires_at?: string | null;
  created_at?: string;
  invited_by?: string | null;
  accepted_by?: string | null;
  user_id?: string | null;
};

export function membershipRole(role: string): string {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'staff') return 'staff';
  if (role === 'medico' || role === 'estetista' || role === 'profissional') return 'profissional';
  if (role === 'cliente' || role === 'paciente') return 'paciente';
  return 'paciente';
}

const allowedInviteTargets: Record<string, CompanyInviteTargetRole[]> = {
  owner: ['admin', 'staff', 'medico', 'estetista', 'cliente'],
  admin: ['staff', 'medico', 'estetista', 'cliente'],
  staff: ['medico', 'estetista', 'cliente'],
  profissional: ['cliente'],
  paciente: [],
};

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

type MessagingServiceLike = {
  getOrCreateNotificationThread: typeof getOrCreateNotificationThread;
  insertSystemMessage: typeof insertSystemMessage;
};

const defaultMessagingService: MessagingServiceLike = {
  getOrCreateNotificationThread,
  insertSystemMessage,
};

type CreateCompanyInviteOptions = {
  tokenFactory?: () => string;
  now?: () => Date;
  messagingService?: MessagingServiceLike;
};

type AcceptCompanyInviteOptions = {
  messagingService?: MessagingServiceLike;
};

function buildCompanyAcceptLink(token: string): string {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/company/invite/accept/${token}`;
}

function withAcceptLink(row: CompanyInviteRow): CompanyInviteRow & { acceptLink: string } {
  return { ...row, acceptLink: buildCompanyAcceptLink(row.accept_token ?? '') };
}

function assertCanInvite(inviterCompanyRole: string, targetRole: CompanyInviteTargetRole) {
  if (!allowedInviteTargets[inviterCompanyRole]?.includes(targetRole)) {
    throw new CompanyInviteError('COMPANY_INVITE_FORBIDDEN', 403);
  }
}

async function getClinicName(db: SupabaseLike, companyId: string): Promise<string> {
  const { data } = await db.from('companies').select('name').eq('id', companyId).maybeSingle();
  return String((data as { name?: string } | null)?.name ?? 'la clinica');
}

function assertUsable(row: CompanyInviteRow | null): CompanyInviteRow {
  if (!row) throw new CompanyInviteError('COMPANY_INVITE_NOT_FOUND', 404);
  if (row.status === 'accepted') return row;
  if (row.status !== 'pending') throw new CompanyInviteError('COMPANY_INVITE_NOT_PENDING', 422);
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) throw new CompanyInviteError('COMPANY_INVITE_EXPIRED', 422);
  return row;
}

export async function lookupCompanyInvite(db: SupabaseLike, token: string) {
  const { data } = await db.from('company_member_invites').select('*').eq('accept_token', token).maybeSingle();
  const invite = assertUsable(data as CompanyInviteRow | null);
  return {
    email: invite.email,
    nome: invite.nome ?? null,
    cognome: invite.cognome ?? null,
    role: invite.role,
    companyId: invite.company_id,
    companyName: null,
    expiresAt: invite.expires_at ?? null,
    userId: invite.user_id ?? null,
    status: invite.status === 'accepted' ? 'accepted' as const : 'pending' as const,
  };
}

export async function acceptCompanyInvite(db: SupabaseLike, token: string, userId: string, options: AcceptCompanyInviteOptions = {}) {
  const { data } = await db.from('company_member_invites').select('*').eq('accept_token', token).maybeSingle();
  const invite = assertUsable(data as CompanyInviteRow | null);
  if (invite.status === 'accepted') {
    return { companyId: invite.company_id, role: invite.role, membershipRole: membershipRole(invite.role), alreadyMember: true };
  }

  const { error: memberError } = await db.from('company_members').upsert({
    company_id: invite.company_id,
    user_id: userId,
    role: membershipRole(invite.role),
    is_active: true,
    joined_at: new Date().toISOString(),
  });
  if (memberError) throw new CompanyInviteError('COMPANY_MEMBER_LINK_FAILED', 500);

  const { error: inviteError } = await db.from('company_member_invites').update({
    status: 'accepted',
    accepted_by: userId,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }).eq('id', invite.id);
  if (inviteError) throw new CompanyInviteError('COMPANY_INVITE_ACCEPT_FAILED', 500);

  if (invite.invited_by) {
    const messaging = options.messagingService ?? defaultMessagingService;
    const clinicName = await getClinicName(db, invite.company_id);
    const threadId = await messaging.getOrCreateNotificationThread(db, [userId, invite.invited_by]);
    await messaging.insertSystemMessage(db, threadId, userId, 'invite_accepted', {
      type: 'invite_accepted',
      inviteId: invite.id,
      clinicName,
      acceptedByName: 'Utente invitato',
    });
  }

  return { companyId: invite.company_id, role: invite.role, membershipRole: membershipRole(invite.role), alreadyMember: false };
}

export async function createCompanyInvite(
  db: SupabaseLike,
  payload: CreateCompanyInvitePayload,
  emailService: EmailService,
  options: CreateCompanyInviteOptions = {},
): Promise<{ invite: CompanyInviteRow; acceptLink: string }> {
  assertCanInvite(payload.inviterCompanyRole, payload.role);

  const { data: activeMember } = await db
    .from('company_members')
    .select('id, users!inner(email)')
    .eq('company_id', payload.companyId)
    .eq('is_active', true)
    .eq('users.email', payload.email)
    .maybeSingle();
  if (activeMember) throw new CompanyInviteError('ALREADY_MEMBER', 409);

  const { data: pendingInvite } = await db
    .from('company_member_invites')
    .select('id')
    .eq('company_id', payload.companyId)
    .ilike('email', payload.email)
    .eq('status', 'pending')
    .maybeSingle();
  if (pendingInvite) throw new CompanyInviteError('INVITE_ALREADY_PENDING', 409);

  const now = options.now?.() ?? new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (payload.expiresInDays ?? 7));
  const acceptToken = options.tokenFactory?.() ?? crypto.randomUUID();

  const { data, error } = await db.from('company_member_invites').insert({
    company_id: payload.companyId,
    invited_by: payload.inviterId,
    email: payload.email,
    nome: payload.nome ?? null,
    cognome: payload.cognome ?? null,
    role: payload.role,
    status: 'pending',
    accept_token: acceptToken,
    expires_at: expiresAt.toISOString(),
  }).select('*').single();
  if (error || !data) throw new CompanyInviteError('COMPANY_INVITE_CREATE_FAILED', 500);

  const invite = data as CompanyInviteRow;
  const acceptLink = buildCompanyAcceptLink(invite.accept_token ?? acceptToken);
  const clinicName = await getClinicName(db, payload.companyId);
  await emailService.sendCompanyInviteEmail({
    to: invite.email,
    nome: invite.nome,
    clinicName,
    role: invite.role,
    acceptLink,
  });

  const { data: existingUser } = await db
    .from('users')
    .select('id')
    .eq('email', payload.email)
    .maybeSingle();

  if (existingUser) {
    const messaging = options.messagingService ?? defaultMessagingService;
    const threadId = await messaging.getOrCreateNotificationThread(db, [payload.inviterId, String((existingUser as { id: string }).id)]);
    await messaging.insertSystemMessage(db, threadId, payload.inviterId, 'company_invite', {
      type: 'company_invite',
      inviteId: invite.id,
      clinicName,
      role: payload.role,
      token: invite.accept_token ?? acceptToken,
    });
  }

  return { invite, acceptLink };
}

export async function listCompanyInvites(
  db: SupabaseLike,
  companyId: string,
  pagination: { page: number; limit: number },
): Promise<{ data: (CompanyInviteRow & { acceptLink: string })[]; total: number; page: number; limit: number; pages: number }> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await db
    .from('company_member_invites')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new CompanyInviteError('COMPANY_INVITE_LIST_FAILED', 500);
  const total = count ?? 0;
  return {
    data: ((data ?? []) as CompanyInviteRow[]).map(withAcceptLink),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function revokeCompanyInvite(db: SupabaseLike, inviteId: string, companyId: string): Promise<void> {
  const { data } = await db
    .from('company_member_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('company_id', companyId)
    .maybeSingle();
  const invite = data as CompanyInviteRow | null;
  if (!invite) throw new CompanyInviteError('COMPANY_INVITE_NOT_FOUND', 404);
  if (invite.status !== 'pending') throw new CompanyInviteError('COMPANY_INVITE_NOT_PENDING', 422);

  const { error } = await db
    .from('company_member_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('company_id', companyId)
    .select('*')
    .single();
  if (error) throw new CompanyInviteError('COMPANY_INVITE_REVOKE_FAILED', 500);
}

export async function resendCompanyInvite(
  db: SupabaseLike,
  inviteId: string,
  companyId: string,
  emailService: EmailService,
): Promise<{ acceptLink: string }> {
  const { data } = await db
    .from('company_member_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('company_id', companyId)
    .maybeSingle();
  const invite = assertUsable(data as CompanyInviteRow | null);
  const acceptLink = buildCompanyAcceptLink(invite.accept_token ?? '');

  await emailService.sendCompanyInviteEmail({
    to: invite.email,
    nome: invite.nome,
    clinicName: await getClinicName(db, companyId),
    role: invite.role,
    acceptLink,
  });

  return { acceptLink };
}
