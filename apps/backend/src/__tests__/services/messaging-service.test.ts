import { describe, expect, it, vi } from 'vitest';
import {
  getOrCreateNotificationThread,
  getThreadMessages,
  getUnreadCount,
  insertSystemMessage,
  listNotificationThreads,
  markThreadAsRead,
} from '../../services/messaging-service';

function makeDb(state: {
  existingThread?: Record<string, unknown> | null;
  insertedThread?: Record<string, unknown>;
  insertedMessage?: Record<string, unknown>;
  threads?: Record<string, unknown>[];
  messages?: Record<string, unknown>[];
  count?: number;
}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const db = {
    from: vi.fn((table: string) => {
      if (table === 'message_threads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          then: vi.fn((resolve) => resolve({ data: state.threads ?? [], error: null })),
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
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: state.messages != null ? state.messages : [{ id: 'msg-1', read_by: [] }],
            count: state.count ?? 0,
            error: null,
          }),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: state.messages ?? [], count: state.count ?? (state.messages ?? []).length, error: null }),
          insert: vi.fn((payload: unknown) => {
            inserts.push({ table, payload });
            return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: state.insertedMessage, error: null }) };
          }),
          update: vi.fn((payload: unknown) => {
            updates.push({ table, payload });
            return { eq: vi.fn().mockReturnThis(), not: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { db, inserts, updates };
}

describe('messaging-service', () => {
  it('returns an existing notification thread for exact participants', async () => {
    const { db } = makeDb({ existingThread: { id: 'thread-1', participant_ids: ['a', 'b'] } });
    await expect(getOrCreateNotificationThread(db, ['b', 'a'])).resolves.toBe('thread-1');
  });

  it('creates notification threads with sorted unique participants', async () => {
    const { db, inserts } = makeDb({ insertedThread: { id: 'thread-2' } });
    await expect(getOrCreateNotificationThread(db, ['b', 'a', 'a'])).resolves.toBe('thread-2');
    expect(inserts[0]).toMatchObject({
      table: 'message_threads',
      payload: { thread_type: 'notification', participant_ids: ['a', 'b'] },
    });
  });

  it('inserts system messages with Italian fallback content', async () => {
    const { db, inserts, updates } = makeDb({ insertedMessage: { id: 'message-1' } });
    await insertSystemMessage(db, 'thread-1', 'sender-1', 'company_invite', {
      type: 'company_invite',
      inviteId: '11111111-1111-4111-8111-111111111111',
      clinicName: 'Clinica Roma',
      role: 'medico',
      token: 'token-1',
    });
    expect(inserts[0]).toMatchObject({
      table: 'message_messages',
      payload: expect.objectContaining({ type: 'system', content: 'Sei stato invitato a unirti a Clinica Roma come medico' }),
    });
    expect(updates[0]).toMatchObject({ table: 'message_threads', payload: expect.objectContaining({ last_message_id: 'message-1' }) });
  });

  it('lists notification threads with pagination metadata', async () => {
    const { db } = makeDb({ count: 1, threads: [{ id: 'thread-1', participant_ids: ['user-1'], updated_at: '2026-06-25T10:00:00.000Z' }] });
    const result = await listNotificationThreads(db, 'user-1', { page: 1, limit: 20 });
    expect(result).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });
  });

  it('gets thread messages only after participant check', async () => {
    const { db } = makeDb({
      existingThread: { id: 'thread-1', participant_ids: ['user-1'] },
      messages: [{ id: 'message-1', thread_id: 'thread-1', sender_id: 'sender-1', type: 'system', created_at: '2026-06-25T10:00:00.000Z' }],
      count: 1,
    });
    const result = await getThreadMessages(db, 'thread-1', 'user-1', { page: 1, limit: 50 });
    expect(result.data).toHaveLength(1);
  });

  it('marks a thread as read for the user', async () => {
    const { db, updates } = makeDb({ existingThread: { id: 'thread-1', participant_ids: ['user-1'] } });
    await markThreadAsRead(db, 'thread-1', 'user-1');
    expect(updates[0]).toMatchObject({ table: 'message_messages', payload: { read_by: expect.any(Array) } });
  });

  it('returns unread count', async () => {
    const { db } = makeDb({ count: 3, threads: [{ id: 'thread-1' }], messages: [] });
    await expect(getUnreadCount(db, 'user-1')).resolves.toBe(3);
  });

  it('gets chat thread messages when requested with threadType chat', async () => {
    const { db } = makeDb({
      existingThread: { id: 'thread-1', thread_type: 'chat', participant_ids: ['user-1'] },
      messages: [{ id: 'message-1', thread_id: 'thread-1', sender_id: 'user-1', type: 'text', content: 'Ciao', created_at: '2026-06-25T10:00:00.000Z' }],
      count: 1,
    });

    const result = await getThreadMessages(db, 'thread-1', 'user-1', { page: 1, limit: 50 }, 'chat');

    expect(result.data[0]).toMatchObject({ type: 'text', content: 'Ciao' });
  });

  it('marks chat threads as read when requested with threadType chat', async () => {
    const { db, updates } = makeDb({
      existingThread: { id: 'thread-1', thread_type: 'chat', participant_ids: ['user-1'] },
      messages: [{ id: 'message-1', read_by: [] }],
    });

    await markThreadAsRead(db, 'thread-1', 'user-1', 'chat');

    expect(updates[0]).toMatchObject({ table: 'message_messages' });
  });

  it('formats booking and PPL notification contents in Italian', async () => {
    const inserts: any[] = [];
    const db = {
      from: vi.fn((table: string) => ({
        insert: vi.fn((payload: any) => {
          inserts.push({ table, payload });
          return { select: () => ({ single: async () => ({ data: { id: 'message-1' }, error: null }) }) };
        }),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        select: vi.fn(() => ({ single: async () => ({ data: { id: 'thread-1' }, error: null }) })),
      })),
    } as any;

    const { insertSystemMessage } = await import('../../services/messaging-service');

    await insertSystemMessage(db, 'thread-1', 'sender-1', 'ppl_invite_received', {
      inviteId: '11111111-1111-4111-8111-111111111111',
      professionalName: 'Dott.ssa Bianchi',
    });
    await insertSystemMessage(db, 'thread-1', 'sender-1', 'ppl_invite_accepted', {
      inviteId: '22222222-2222-4222-8222-222222222222',
      patientName: 'Ada Rossi',
    });
    await insertSystemMessage(db, 'thread-1', 'sender-1', 'appointment_confirmed', {
      appointmentId: '33333333-3333-4333-8333-333333333333',
      date: '2026-07-01',
      professionalName: 'Dott.ssa Bianchi',
    });

    expect(inserts.map((entry) => entry.payload.content)).toEqual([
      'Dott.ssa Bianchi ti ha invitato come suo paziente',
      'Ada Rossi ha accettato il tuo invito',
      'Il tuo appuntamento del 2026-07-01 è stato confermato',
    ]);
  });

  it('formats consent notification messages', async () => {
    const inserts: any[] = [];
    const db = {
      from: vi.fn((table: string) => ({
        insert: vi.fn((payload: any) => {
          inserts.push({ table, payload });
          return { select: () => ({ single: async () => ({ data: { id: 'message-1' }, error: null }) }) };
        }),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      })),
    } as any;

    await insertSystemMessage(db, 'thread-1', 'sender-1', 'consent_fully_signed', {
      consentId: '11111111-1111-4111-8111-111111111111',
      patientName: 'Ada Rossi',
    });

    expect(inserts[0].payload.content).toBe('Ada Rossi ha firmato il consenso informato');
  });
});
