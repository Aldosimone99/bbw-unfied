import type { CreateInviteRequest, RegisterableRole } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import type { EmailService } from './email-service';
import { createEmailService } from './email-service';
import { generateProfessionalCode, normalizeReferralCode } from './referral-code-service';

export class InviteError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
  }
}

export type InviteRow = {
  id?: string;
  code: string;
  email: string;
  nome?: string | null;
  cognome?: string | null;
  type: RegisterableRole;
  status: string;
  expires_at: string;
  created_at?: string;
  used_at?: string | null;
  company_id?: string | null;
  owner_id?: string | null;
  accept_token?: string | null;
};

const allowedInviteTargets: Record<string, RegisterableRole[]> = {
  admin: ['cliente', 'medico', 'estetista', 'clinica', 'commerciale'],
  commerciale: ['clinica', 'medico', 'estetista'],
  medico: ['cliente'],
  estetista: ['cliente'],
  cliente: ['cliente'],
};

type CreateInviteOptions = {
  force?: boolean;
  emailService?: EmailService;
  tokenFactory?: () => string;
  now?: () => Date;
};

function assertCanCreateInvite(ownerRole: string, targetRole: RegisterableRole) {
  if (!allowedInviteTargets[ownerRole]?.includes(targetRole)) {
    throw new InviteError('INVITE_FORBIDDEN', 403);
  }
}

function buildAcceptLink(token: string): string {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/invite/accept/${token}`;
}

function withAcceptLink(row: InviteRow): InviteRow & { acceptLink: string } {
  return {
    ...row,
    acceptLink: buildAcceptLink(row.accept_token ?? ''),
  };
}

function assertUsableInvite(row: InviteRow | null): InviteRow {
  if (!row) throw new InviteError('INVITE_NOT_FOUND', 404);
  if (row.status !== 'pending') throw new InviteError('INVITE_NOT_PENDING', 422);
  if (new Date(row.expires_at).getTime() <= Date.now()) throw new InviteError('INVITE_EXPIRED', 422);
  return row;
}

export async function createInvite(
  db: SupabaseLike,
  ownerId: string,
  ownerRole: string,
  payload: CreateInviteRequest,
  options: CreateInviteOptions = {},
): Promise<{ invite: InviteRow; acceptLink: string }> {
  assertCanCreateInvite(ownerRole, payload.type);

  if (!options.force && !payload.force) {
    const { data: existingUser } = await db.from('users').select('id').eq('email', payload.email).maybeSingle();
    if (existingUser) throw new InviteError('INVITE_EMAIL_ALREADY_EXISTS', 409);
  }

  const now = options.now?.() ?? new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (payload.expires_in_days ?? 7));

  const acceptToken = options.tokenFactory?.() ?? crypto.randomUUID();
  const insertPayload = {
    owner_id: ownerId,
    commerciale_id: ownerId,
    code: generateProfessionalCode('INV'),
    email: payload.email,
    nome: payload.nome ?? null,
    cognome: payload.cognome ?? null,
    type: payload.type,
    status: 'pending',
    accept_token: acceptToken,
    expires_at: expiresAt.toISOString(),
  };

  const { data, error } = await db.from('invites').insert(insertPayload).select('*').single();
  if (error || !data) throw new InviteError('INVITE_CREATE_FAILED', 500);

  const invite = data as InviteRow;
  const acceptLink = buildAcceptLink(invite.accept_token ?? acceptToken);
  await (options.emailService ?? createEmailService()).sendInviteEmail({
    to: invite.email,
    nome: invite.nome,
    role: invite.type,
    acceptLink,
  });

  return { invite, acceptLink };
}

export async function listInvites(
  db: SupabaseLike,
  ownerId: string,
  pagination: { page: number; limit: number },
): Promise<{ data: (InviteRow & { acceptLink: string })[]; total: number; page: number; limit: number; pages: number }> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await db
    .from('invites')
    .select('*', { count: 'exact' })
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new InviteError('INVITE_LIST_FAILED', 500);
  const total = count ?? 0;
  return {
    data: ((data ?? []) as InviteRow[]).map(withAcceptLink),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function revokeInvite(db: SupabaseLike, inviteId: string, ownerId: string): Promise<void> {
  const { data } = await db.from('invites').select('*').eq('id', inviteId).eq('owner_id', ownerId).maybeSingle();
  const invite = data as InviteRow | null;
  if (!invite) throw new InviteError('INVITE_NOT_FOUND', 404);
  if (invite.status !== 'pending') throw new InviteError('INVITE_NOT_PENDING', 422);

  const { error } = await db
    .from('invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('owner_id', ownerId)
    .select('*')
    .single();

  if (error) throw new InviteError('INVITE_REVOKE_FAILED', 500);
}

export async function resendInvite(
  db: SupabaseLike,
  inviteId: string,
  ownerId: string,
  emailService: EmailService = createEmailService(),
): Promise<{ acceptLink: string }> {
  const { data } = await db.from('invites').select('*').eq('id', inviteId).eq('owner_id', ownerId).maybeSingle();
  const invite = assertUsableInvite(data as InviteRow | null);
  const acceptLink = buildAcceptLink(invite.accept_token ?? '');

  await emailService.sendInviteEmail({
    to: invite.email,
    nome: invite.nome,
    role: invite.type,
    acceptLink,
  });

  return { acceptLink };
}

export async function validateInviteCode(db: SupabaseLike, code: string): Promise<InviteRow> {
  const normalized = normalizeReferralCode(code);
  const { data } = await db.from('invites').select('*').eq('code', normalized).maybeSingle();
  return assertUsableInvite(data as InviteRow | null);
}

export async function lookupInviteByToken(db: SupabaseLike, token: string) {
  const { data } = await db.from('invites').select('*').eq('accept_token', token).maybeSingle();
  const invite = assertUsableInvite(data as InviteRow | null);
  return {
    valid: true,
    code: invite.code,
    email: invite.email,
    nome: invite.nome ?? null,
    cognome: invite.cognome ?? null,
    role: invite.type,
    expiresAt: invite.expires_at,
    companyId: invite.company_id ?? null,
    companyName: null,
  };
}

export async function redeemInviteCode(db: SupabaseLike, code: string, userId: string): Promise<void> {
  const invite = await validateInviteCode(db, code);
  const { error } = await db.from('invites').update({
    status: 'used',
    used_by: userId,
    used_at: new Date().toISOString(),
  }).eq('code', invite.code);
  if (error) throw new InviteError('INVITE_REDEEM_FAILED', 500);
}
