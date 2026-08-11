import type { MessageRow, NotificationThread, SystemMessageContext } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';

export type SystemMessageType = SystemMessageContext['type'];
type MessageThreadType = 'notification' | 'chat';

export class MessagingError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
  }
}

function normalizeParticipants(participantIds: string[]): string[] {
  return Array.from(new Set(participantIds.filter(Boolean))).sort();
}

function contentFor(type: SystemMessageType, context: Record<string, unknown>): string {
  if (type === 'company_invite') return `Sei stato invitato a unirti a ${context.clinicName} come ${context.role}`;
  if (type === 'invite_accepted') return `${context.acceptedByName} ha accettato il tuo invito per ${context.clinicName}`;
  if (type === 'ppl_invite_received') return `${context.professionalName} ti ha invitato come suo paziente`;
  if (type === 'ppl_invite_accepted') return `${context.patientName} ha accettato il tuo invito`;
  if (type === 'appointment_created') return `Nuova richiesta di appuntamento per il ${context.date}`;
  if (type === 'appointment_confirmed') return `Il tuo appuntamento del ${context.date} è stato confermato`;
  if (type === 'appointment_cancelled') return `L'appuntamento del ${context.date} è stato annullato`;
  if (type === 'consent_awaiting_signature') return `Consenso informato da firmare per ${context.treatmentName}`;
  if (type === 'consent_awaiting_clinic_signature') return `Consenso informato in attesa di firma clinica per ${context.professionalName}`;
  if (type === 'consent_awaiting_client_signature') return `Consenso informato pronto per la firma del paziente`;
  if (type === 'consent_fully_signed') return `${context.patientName} ha firmato il consenso informato`;
  if (type === 'consent_revoked') return `Consenso informato revocato: ${context.reason}`;
  return 'Nuova notifica';
}

async function assertParticipant(db: SupabaseLike, threadId: string, userId: string, threadType: MessageThreadType = 'notification') {
  const { data } = await db
    .from('message_threads')
    .select('*')
    .eq('id', threadId)
    .eq('thread_type', threadType)
    .contains('participant_ids', [userId])
    .maybeSingle();
  if (!data) throw new MessagingError('THREAD_NOT_FOUND', 404);
  return data as { id: string; participant_ids: string[] };
}

export async function getOrCreateNotificationThread(db: SupabaseLike, participantIds: string[]): Promise<string> {
  const normalized = normalizeParticipants(participantIds);
  const { data: existing } = await db
    .from('message_threads')
    .select('*')
    .eq('thread_type', 'notification')
    .contains('participant_ids', normalized)
    .maybeSingle();

  const exact = existing as { id: string; participant_ids?: string[] } | null;
  if (exact && normalizeParticipants(exact.participant_ids ?? []).join('|') === normalized.join('|')) return exact.id;

  const { data, error } = await db
    .from('message_threads')
    .insert({ thread_type: 'notification', participant_ids: normalized })
    .select('id')
    .single();
  if (error || !data) throw new MessagingError('THREAD_CREATE_FAILED', 500);
  return String((data as { id: string }).id);
}

export async function insertSystemMessage(
  db: SupabaseLike,
  threadId: string,
  senderId: string,
  type: SystemMessageType,
  context: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await db
    .from('message_messages')
    .insert({
      thread_id: threadId,
      sender_id: senderId,
      type: 'system',
      content: contentFor(type, context),
      context: { ...context, type },
      read_by: [senderId],
    })
    .select('id')
    .single();
  if (error || !data) throw new MessagingError('MESSAGE_INSERT_FAILED', 500);

  await db
    .from('message_threads')
    .update({ last_message_id: (data as { id: string }).id, updated_at: new Date().toISOString() })
    .eq('id', threadId);
}

export async function listNotificationThreads(
  db: SupabaseLike,
  userId: string,
  pagination: { page: number; limit: number },
): Promise<{ data: NotificationThread[]; total: number; page: number; limit: number; pages: number }> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await db
    .from('message_threads')
    .select('*, last_message:last_message_id(*)', { count: 'exact' })
    .eq('thread_type', 'notification')
    .contains('participant_ids', [userId])
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (error) throw new MessagingError('THREAD_LIST_FAILED', 500);

  return {
    data: ((data ?? []) as any[]).map((thread) => ({
      id: thread.id,
      participant_ids: thread.participant_ids ?? [],
      last_message: thread.last_message ?? null,
      unread_count: thread.last_message?.read_by?.includes(userId) ? 0 : thread.last_message ? 1 : 0,
      updated_at: thread.updated_at,
    })),
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  };
}

export async function getThreadMessages(
  db: SupabaseLike,
  threadId: string,
  userId: string,
  pagination: { page: number; limit: number },
  threadType: MessageThreadType = 'notification',
): Promise<{ data: MessageRow[]; total: number; page: number; limit: number; pages: number }> {
  await assertParticipant(db, threadId, userId, threadType);
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await db
    .from('message_messages')
    .select('*', { count: 'exact' })
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new MessagingError('MESSAGE_LIST_FAILED', 500);
  return { data: (data ?? []) as MessageRow[], total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) };
}

export async function markThreadAsRead(db: SupabaseLike, threadId: string, userId: string, threadType: MessageThreadType = 'notification'): Promise<void> {
  await assertParticipant(db, threadId, userId, threadType);
  const { data } = await db.from('message_messages').select('id, read_by').eq('thread_id', threadId).not('read_by', 'cs', `{${userId}}`);
  const unread = (data ?? []) as { id: string; read_by?: string[] | null }[];
  for (const message of unread) {
    await db.from('message_messages').update({ read_by: Array.from(new Set([...(message.read_by ?? []), userId])) }).eq('id', message.id).not('read_by', 'cs', `{${userId}}`);
  }
}

export async function getUnreadCount(db: SupabaseLike, userId: string): Promise<number> {
  const { data: threads, error: threadsError } = await db
    .from('message_threads')
    .select('id')
    .eq('thread_type', 'notification')
    .contains('participant_ids', [userId]);
  if (threadsError) throw new MessagingError('UNREAD_COUNT_FAILED', 500);

  const threadIds = ((threads ?? []) as { id: string }[]).map((t) => t.id);
  if (threadIds.length === 0) return 0;

  const { count, error } = await db
    .from('message_messages')
    .select('id', { count: 'exact', head: true })
    .in('thread_id', threadIds)
    .not('read_by', 'cs', `{${userId}}`);
  if (error) throw new MessagingError('UNREAD_COUNT_FAILED', 500);
  return count ?? 0;
}
