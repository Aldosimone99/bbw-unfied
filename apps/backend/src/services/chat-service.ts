import type { SupabaseLike } from '../db/supabase';
import { MessagingError } from './messaging-service';

function normalizeParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getOrCreateChatThread(db: SupabaseLike, userId: string, recipientId: string): Promise<string> {
  const { data: user } = await db
    .from('users')
    .select('tipo_utente')
    .eq('id', userId)
    .maybeSingle();
  const role = (user as { tipo_utente?: string } | null)?.tipo_utente;

  if (role !== 'admin' && role !== 'super_admin') {
    const { data: allowed } = await db.rpc('is_allowed_to_chat', { user_a: userId, user_b: recipientId });
    if (!allowed) throw new MessagingError('CHAT_NOT_ALLOWED', 403);
  }

  const [userAId, userBId] = normalizeParticipants(userId, recipientId);
  const canonical = [userAId, userBId];

  const { data: existing } = await db
    .from('message_threads')
    .select('id')
    .eq('thread_type', 'chat')
    .contains('participant_ids', canonical)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data, error } = await db
    .from('message_threads')
    .insert({ thread_type: 'chat', participant_ids: canonical, user_a_id: userAId, user_b_id: userBId })
    .select('id')
    .single();

  if (error || !data) throw new MessagingError('THREAD_CREATE_FAILED', 500);
  return (data as { id: string }).id;
}

export async function sendChatMessage(
  db: SupabaseLike,
  threadId: string,
  senderId: string,
  content: string,
): Promise<Record<string, unknown>> {
  const { data: thread } = await db
    .from('message_threads')
    .select('participant_ids')
    .eq('id', threadId)
    .eq('thread_type', 'chat')
    .maybeSingle();
  if (!thread) throw new MessagingError('THREAD_NOT_FOUND', 404);

  const participants = (thread as { participant_ids: string[] }).participant_ids;
  if (!participants.includes(senderId)) throw new MessagingError('NOT_PARTICIPANT', 403);

  const { data, error } = await db
    .from('message_messages')
    .insert({ thread_id: threadId, sender_id: senderId, type: 'text', content, read_by: [senderId] })
    .select('id')
    .single();

  if (error || !data) throw new MessagingError('MESSAGE_INSERT_FAILED', 500);

  const messageId = (data as { id: string }).id;
  await db
    .from('message_threads')
    .update({ last_message_id: messageId, updated_at: new Date().toISOString() })
    .eq('id', threadId);

  return (data as Record<string, unknown>);
}

export async function listChatThreads(
  db: SupabaseLike,
  userId: string,
  pagination: { page: number; limit: number },
): Promise<{ data: Record<string, unknown>[]; total: number; page: number; limit: number; pages: number }> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: threads, count, error } = await db
    .from('message_threads')
    .select('*, last_message:last_message_id(*)', { count: 'exact' })
    .eq('thread_type', 'chat')
    .contains('participant_ids', [userId])
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (error) throw new MessagingError('THREAD_LIST_FAILED', 500);

  const rawThreads = (threads ?? []) as {
    id: string;
    participant_ids: string[];
    last_message: Record<string, unknown> | null;
    updated_at: string;
  }[];

  const otherIds = [...new Set(rawThreads.map((t) => t.participant_ids.find((id) => id !== userId)!).filter(Boolean))];

  let contactMap: Record<string, Record<string, unknown>> = {};
  if (otherIds.length > 0) {
    const { data: contacts } = await db
      .from('users')
      .select('id, nome, cognome, tipo_utente, avatar_url')
      .in('id', otherIds);
    contactMap = Object.fromEntries((contacts ?? []).map((c: Record<string, unknown>) => [c.id as string, c]));
  }

  const result = rawThreads.map((thread) => {
    const otherId = thread.participant_ids.find((id) => id !== userId)!;
    return {
      id: thread.id,
      participant_ids: thread.participant_ids,
      other_participant: contactMap[otherId] ?? null,
      last_message: thread.last_message ?? null,
      unread_count: (() => {
        const lm = thread.last_message as Record<string, unknown> | null;
        if (!lm) return 0;
        const readBy = lm.read_by as string[] | undefined;
        return readBy?.includes(userId) ? 0 : 1;
      })(),
      updated_at: thread.updated_at,
    };
  });

  return {
    data: result,
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  };
}

export async function getChatContacts(db: SupabaseLike, userId: string, userRole?: string, companyId?: string): Promise<Record<string, unknown>[]> {
  if (companyId) {
    const { data, error } = await db
      .from('company_members')
      .select('user_id, users!inner(id, nome, cognome, tipo_utente, avatar)')
      .eq('company_id', companyId)
      .neq('user_id', userId)
      .is('is_active', true);
    if (error) throw new MessagingError('CONTACTS_FETCH_FAILED', 500);
    return ((data ?? []) as Record<string, unknown>[]).map((cm: Record<string, unknown>) => {
      const u = cm.users as Record<string, unknown> || {};
      return {
        id: u.id,
        nome: u.nome,
        cognome: u.cognome,
        tipo_utente: u.tipo_utente,
        avatar_url: u.avatar,
        company_id: companyId,
      };
    });
  }

  if (userRole === 'admin' || userRole === 'super_admin') {
    const { data, error } = await db
      .from('users')
      .select('id, nome, cognome, tipo_utente, avatar')
      .neq('id', userId)
      .order('nome', { ascending: true });
    if (error) throw new MessagingError('CONTACTS_FETCH_FAILED', 500);
    return (data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      nome: c.nome,
      cognome: c.cognome,
      tipo_utente: c.tipo_utente,
      avatar_url: c.avatar,
      company_id: null,
    }));
  }

  const { data, error } = await db.rpc('get_chat_contacts', { user_id: userId });
  if (error) throw new MessagingError('CONTACTS_FETCH_FAILED', 500);
  return Object.values(Object.fromEntries(((data ?? []) as Record<string, unknown>[]).map((c: Record<string, unknown>) => [c.id as string, c])));
}
