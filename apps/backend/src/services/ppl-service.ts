import type { SupabaseLike } from '../db/supabase';
import type { EmailService } from './email-service';
import {
  getOrCreateNotificationThread,
  insertSystemMessage,
} from './messaging-service';

export class PPLError extends Error {
  constructor(public code: string, public statusCode: number, message = code) {
    super(message);
  }
}

export type PPLRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  company_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  invited_by?: string | null;
  response_date?: string | null;
};

export type PPLInviteRow = {
  id: string;
  professional_id: string;
  company_id: string | null;
  patient_id: string | null;
  email: string;
  nome: string | null;
  cognome: string | null;
  accept_token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

type PaginatedResult<T> = { data: T[]; total: number; page: number; limit: number; pages: number };

type MessagingServiceLike = {
  getOrCreateNotificationThread: typeof getOrCreateNotificationThread;
  insertSystemMessage: typeof insertSystemMessage;
};

const defaultMessagingService: MessagingServiceLike = {
  getOrCreateNotificationThread,
  insertSystemMessage,
};

function buildPPLAcceptLink(token: string): string {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/professional/invite/accept/${token}`;
}

async function getUserByEmail(db: SupabaseLike, email: string) {
  const { data } = await db.from('users').select('id, email, nome, cognome').eq('email', email).maybeSingle();
  return data as { id: string; email: string; nome?: string | null; cognome?: string | null } | null;
}

async function getUser(db: SupabaseLike, userId: string) {
  const { data } = await db.from('users').select('id, email, nome, cognome').eq('id', userId).maybeSingle();
  return data as { id: string; email?: string; nome?: string | null; cognome?: string | null } | null;
}

async function getProfessionalName(db: SupabaseLike, professionalId: string): Promise<string> {
  const user = await getUser(db, professionalId);
  return [user?.nome, user?.cognome].filter(Boolean).join(' ') || 'Il professionista';
}

async function getClinicName(db: SupabaseLike, companyId: string | null): Promise<string | null> {
  if (!companyId) return null;
  const { data } = await db.from('companies').select('name').eq('id', companyId).maybeSingle();
  return String((data as { name?: string } | null)?.name ?? 'la clinica');
}

async function hasActiveBooking(db: SupabaseLike, patientId: string, professionalId: string, companyId: string | null): Promise<boolean> {
  let query = db
    .from('bookings')
    .select('id')
    .eq('patient_id', patientId)
    .eq('professional_id', professionalId);

  query = companyId ? query.eq('company_id', companyId) : query.is('company_id', null);
  const { data } = await query.in('status', ['confirmed', 'completed']).maybeSingle();
  return Boolean(data);
}

export async function createPPLInvite(
  db: SupabaseLike,
  payload: {
    professionalId: string;
    companyId: string | null;
    email: string;
    nome?: string;
    cognome?: string;
    expiresInDays?: number;
  },
  emailService: EmailService,
  options: { tokenFactory?: () => string; now?: () => Date; messagingService?: MessagingServiceLike } = {},
): Promise<{ invite: PPLInviteRow; pplCreated: boolean }> {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const existingUser = await getUserByEmail(db, normalizedEmail);
  if (existingUser?.id === payload.professionalId) throw new PPLError('SELF_INVITE', 400);

  let pendingQuery = db
    .from('ppl_invites')
    .select('id')
    .eq('professional_id', payload.professionalId)
    .ilike('email', normalizedEmail)
    .eq('status', 'pending');
  pendingQuery = payload.companyId ? pendingQuery.eq('company_id', payload.companyId) : pendingQuery.is('company_id', null);
  const { data: pendingInvite } = await pendingQuery.maybeSingle();
  if (pendingInvite) throw new PPLError('PPL_INVITE_ALREADY_PENDING', 409);

  const now = options.now?.() ?? new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (payload.expiresInDays ?? 7));
  const token = options.tokenFactory?.() ?? crypto.randomUUID();

  const { data, error } = await db.from('ppl_invites').insert({
    professional_id: payload.professionalId,
    company_id: payload.companyId,
    patient_id: existingUser?.id ?? null,
    email: normalizedEmail,
    nome: payload.nome ?? null,
    cognome: payload.cognome ?? null,
    accept_token: token,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  }).select('*').single();
  if (error || !data) throw new PPLError('PPL_INVITE_CREATE_FAILED', 500);

  let pplCreated = false;
  if (existingUser) {
    await setPPLStatus(db, existingUser.id, payload.professionalId, payload.companyId, 'pending', payload.professionalId);
    pplCreated = true;
  }

  const invite = data as PPLInviteRow;
  const professionalName = await getProfessionalName(db, payload.professionalId);
  const clinicName = await getClinicName(db, payload.companyId);
  await emailService.sendPPLInviteEmail({
    to: normalizedEmail,
    nome: payload.nome,
    professionalName,
    clinicName,
    acceptLink: buildPPLAcceptLink(invite.accept_token ?? token),
  });

  if (existingUser) {
    const messaging = options.messagingService ?? defaultMessagingService;
    const threadId = await messaging.getOrCreateNotificationThread(db, [payload.professionalId, existingUser.id]);
    await messaging.insertSystemMessage(db, threadId, payload.professionalId, 'ppl_invite_received', {
      inviteId: invite.id,
      professionalName,
      clinicName: clinicName ?? undefined,
    });
  }

  return { invite, pplCreated };
}

export async function lookupPPLInvite(db: SupabaseLike, token: string) {
  const { data } = await db.from('ppl_invites').select('*').eq('accept_token', token).maybeSingle();
  const invite = data as PPLInviteRow | null;
  if (!invite) throw new PPLError('PPL_INVITE_NOT_FOUND', 404);
  if (invite.status !== 'pending') throw new PPLError('PPL_INVITE_EXPIRED', 410);
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) throw new PPLError('PPL_INVITE_EXPIRED', 410);
  return {
    id: invite.id,
    email: invite.email,
    nome: invite.nome,
    cognome: invite.cognome,
    professionalId: invite.professional_id,
    professionalName: await getProfessionalName(db, invite.professional_id),
    clinicName: await getClinicName(db, invite.company_id),
    expiresAt: invite.expires_at,
    status: 'pending' as const,
  };
}

export async function acceptPPLInvite(
  db: SupabaseLike,
  token: string,
  patientId: string,
  options: { messagingService?: MessagingServiceLike } = {},
): Promise<{ ppl: PPLRow }> {
  const { data } = await db.from('ppl_invites').select('*').eq('accept_token', token).maybeSingle();
  const invite = data as PPLInviteRow | null;
  if (!invite) throw new PPLError('PPL_INVITE_NOT_FOUND', 404);
  if (invite.status !== 'pending') throw new PPLError('PPL_INVITE_EXPIRED', 410);
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) throw new PPLError('PPL_INVITE_EXPIRED', 410);

  const patient = await getUser(db, patientId);
  if (invite.patient_id && invite.patient_id !== patientId) throw new PPLError('PPL_INVITE_IDENTITY_MISMATCH', 403);
  if (!invite.patient_id && patient?.email?.toLowerCase() !== invite.email.toLowerCase()) {
    throw new PPLError('PPL_INVITE_IDENTITY_MISMATCH', 403);
  }

  const ppl = await setPPLStatus(db, patientId, invite.professional_id, invite.company_id, 'approved', invite.professional_id);
  const acceptedAt = new Date().toISOString();
  const { error } = await db.from('ppl_invites').update({
    status: 'accepted',
    accepted_at: acceptedAt,
    patient_id: patientId,
    updated_at: acceptedAt,
  }).eq('id', invite.id);
  if (error) throw new PPLError('PPL_INVITE_ACCEPT_FAILED', 500);

  const messaging = options.messagingService ?? defaultMessagingService;
  const threadId = await messaging.getOrCreateNotificationThread(db, [patientId, invite.professional_id]);
  const patientName = [patient?.nome, patient?.cognome].filter(Boolean).join(' ') || 'Il paziente';
  await messaging.insertSystemMessage(db, threadId, patientId, 'ppl_invite_accepted', {
    inviteId: invite.id,
    patientName,
  });

  return { ppl };
}

export async function revokePPLInvite(db: SupabaseLike, inviteId: string, professionalId: string): Promise<void> {
  const { data } = await db.from('ppl_invites').select('*').eq('id', inviteId).maybeSingle();
  const invite = data as PPLInviteRow | null;
  if (!invite) throw new PPLError('PPL_INVITE_NOT_FOUND', 404);
  if (invite.professional_id !== professionalId) throw new PPLError('PPL_INVITE_FORBIDDEN', 403);
  if (invite.status !== 'pending') throw new PPLError('PPL_INVITE_NOT_PENDING', 422);
  const { error } = await db.from('ppl_invites').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', invite.id);
  if (error) throw new PPLError('PPL_INVITE_REVOKE_FAILED', 500);
}

export async function listPPLInvites(
  db: SupabaseLike,
  professionalId: string,
  companyId: string | null | undefined,
  pagination: { page: number; limit: number },
): Promise<PaginatedResult<PPLInviteRow>> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = db
    .from('ppl_invites')
    .select('*', { count: 'exact' })
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (companyId !== undefined) query = companyId ? query.eq('company_id', companyId) : query.is('company_id', null);

  const { data, count, error } = await query;
  if (error) throw new PPLError('PPL_INVITE_LIST_FAILED', 500);
  const total = count ?? 0;
  return { data: (data ?? []) as PPLInviteRow[], total, page, limit, pages: Math.ceil(total / limit) };
}

export async function setPPLStatus(
  db: SupabaseLike,
  patientId: string,
  professionalId: string,
  companyId: string | null,
  status: 'pending' | 'approved',
  invitedBy?: string | null,
): Promise<PPLRow> {
  if (status === 'pending' && await hasActiveBooking(db, patientId, professionalId, companyId)) {
    const { data } = await db
      .from('patient_professional_links')
      .select('*')
      .eq('patient_id', patientId)
      .eq('professional_id', professionalId)
      .eq('company_id', companyId)
      .maybeSingle();
    return data as PPLRow;
  }

  const responseDate = status === 'approved' ? new Date().toISOString() : null;
  const { data, error } = await db.from('patient_professional_links').upsert({
    patient_id: patientId,
    professional_id: professionalId,
    company_id: companyId,
    status,
    invited_by: invitedBy ?? null,
    clinic_access: Boolean(companyId),
    response_date: responseDate,
  }, { onConflict: 'patient_id,professional_id,company_id' }).select('*').single();
  if (error || !data) throw new PPLError('PPL_STATUS_UPDATE_FAILED', 500);
  return data as PPLRow;
}
