import { describe, expect, it, vi } from 'vitest';
import {
  getChatContacts,
  getOrCreateChatThread,
  listChatThreads,
  sendChatMessage,
} from '../../services/chat-service';

function makeDb(state: {
  allowed?: boolean;
  existingThread?: Record<string, unknown> | null;
  insertedThread?: Record<string, unknown>;
  insertedMessage?: Record<string, unknown>;
  threads?: Record<string, unknown>[];
  contacts?: Record<string, unknown>[];
  count?: number;
  userRole?: string;
}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const db = {
    rpc: vi.fn((fn: string) => {
      if (fn === 'is_allowed_to_chat') return { data: state.allowed ?? true, error: null };
      if (fn === 'get_chat_contacts') return { data: state.contacts ?? [], error: null };
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      if (table === 'message_threads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: state.threads ?? [], count: state.count ?? (state.threads ?? []).length, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: state.existingThread ?? null }),
          insert: vi.fn((payload: unknown) => {
            inserts.push({ table, payload });
            return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: state.insertedThread, error: null }) };
          }),
          update: vi.fn((payload: unknown) => {
            updates.push({ table, payload });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'message_messages') {
        return {
          insert: vi.fn((payload: unknown) => {
            inserts.push({ table, payload });
            return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: state.insertedMessage, error: null }) };
          }),
        };
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: state.contacts ?? [], error: null }),
          in: vi.fn().mockResolvedValue({ data: state.contacts ?? [], error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { tipo_utente: state.userRole ?? 'cliente' }, error: null }),
        };
      }
      if (table === 'company_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ data: state.contacts ?? [], error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { db, inserts, updates };
}

describe('chat-service', () => {
  it('creates a chat thread when users are allowed to chat', async () => {
    const { db, inserts } = makeDb({ insertedThread: { id: 'thread-1' } });
    await expect(getOrCreateChatThread(db, 'user-b', 'user-a')).resolves.toBe('thread-1');
    expect(db.rpc).toHaveBeenCalledWith('is_allowed_to_chat', { user_a: 'user-b', user_b: 'user-a' });
    expect(inserts[0]).toMatchObject({
      table: 'message_threads',
      payload: expect.objectContaining({ thread_type: 'chat', user_a_id: 'user-a', user_b_id: 'user-b' }),
    });
  });

  it('blocks thread creation when users are not allowed to chat', async () => {
    const { db } = makeDb({ allowed: false });
    await expect(getOrCreateChatThread(db, 'user-a', 'user-b')).rejects.toMatchObject({ code: 'CHAT_NOT_ALLOWED', status: 403 });
  });

  it('returns an existing chat thread for a canonical pair', async () => {
    const { db } = makeDb({ existingThread: { id: 'thread-existing' } });
    await expect(getOrCreateChatThread(db, 'user-b', 'user-a')).resolves.toBe('thread-existing');
  });

  it('sends a text message for thread participants', async () => {
    const { db, inserts, updates } = makeDb({
      existingThread: { id: 'thread-1', participant_ids: ['sender-1', 'recipient-1'] },
      insertedMessage: { id: 'message-1', thread_id: 'thread-1', sender_id: 'sender-1', type: 'text', content: 'Ciao', created_at: '2026-06-25T10:00:00.000Z' },
    });
    const result = await sendChatMessage(db, 'thread-1', 'sender-1', 'Ciao');
    expect(result).toMatchObject({ content: 'Ciao' });
    expect(inserts[0]).toMatchObject({ table: 'message_messages', payload: expect.objectContaining({ type: 'text', read_by: ['sender-1'] }) });
    expect(updates[0]).toMatchObject({ table: 'message_threads', payload: expect.objectContaining({ last_message_id: 'message-1' }) });
  });

  it('blocks sending by non participants', async () => {
    const { db } = makeDb({ existingThread: { id: 'thread-1', participant_ids: ['someone-else'] } });
    await expect(sendChatMessage(db, 'thread-1', 'sender-1', 'Ciao')).rejects.toMatchObject({ code: 'NOT_PARTICIPANT', status: 403 });
  });

  it('lists chat threads with other participant', async () => {
    const { db } = makeDb({
      count: 1,
      threads: [{ id: 'thread-1', participant_ids: ['user-1', 'user-2'], updated_at: '2026-06-25T10:00:00.000Z', last_message: null }],
      contacts: [{ id: 'user-2', nome: 'Mario', cognome: 'Rossi', tipo_utente: 'cliente', avatar_url: null }],
    });
    const result = await listChatThreads(db, 'user-1', { page: 1, limit: 20 });
    expect(result.data[0].other_participant).toMatchObject({ id: 'user-2', nome: 'Mario' });
  });

  it('returns deduped chat contacts for non-admin', async () => {
    const { db } = makeDb({ contacts: [{ id: 'user-2', nome: 'Mario', cognome: 'Rossi', tipo_utente: 'cliente', avatar_url: null }] });
    const result = await getChatContacts(db, 'user-1');
    expect(result).toHaveLength(1);
  });

  it('returns all users (except self) for admin', async () => {
    const { db } = makeDb({
      contacts: [
        { id: 'user-2', nome: 'Mario', cognome: 'Rossi', tipo_utente: 'cliente', avatar: null },
        { id: 'user-3', nome: 'Lucia', cognome: 'Bianchi', tipo_utente: 'medico', avatar: null },
      ],
    });
    const result = await getChatContacts(db, 'user-1', 'admin');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'user-2', nome: 'Mario', company_id: null });
  });

  it('filters by company when companyId is provided', async () => {
    const { db } = makeDb({
      contacts: [{ user_id: 'user-2', users: { id: 'user-2', nome: 'Mario', cognome: 'Rossi', tipo_utente: 'cliente', avatar: null } }],
    });
    const result = await getChatContacts(db, 'user-1', 'cliente', 'company-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'user-2', company_id: 'company-1' });
  });
});
