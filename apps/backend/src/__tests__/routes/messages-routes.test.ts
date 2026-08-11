import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createMessagesRouter } from '../../routes/messages-routes';

function makeDb() {
  return {
    rpc: vi.fn((fn: string) => {
      if (fn === 'is_allowed_to_chat') return { data: true, error: null };
      if (fn === 'get_chat_contacts') return { data: [{ id: 'user-2', nome: 'Mario', cognome: 'Rossi', tipo_utente: 'cliente', avatar_url: null }], error: null };
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      if (table === 'message_threads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [{ id: 'thread-chat-1', participant_ids: ['user-1', 'user-2'], thread_type: 'chat', updated_at: '2026-06-25T10:00:00.000Z', last_message: null }],
            count: 1,
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'thread-chat-1', participant_ids: ['user-1', 'user-2'] }, error: null }),
          insert: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'thread-new-1' }, error: null }),
          })),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        };
      }
      if (table === 'message_messages') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({ data: null, count: 5, error: null }),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [{ id: 'msg-1', thread_id: 'thread-chat-1', sender_id: 'user-2', type: 'text', content: 'Ciao', read_by: ['user-2'], created_at: '2026-06-25T10:00:00.000Z' }], count: 1, error: null }),
          insert: vi.fn((payload: unknown) => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'msg-new-1', ...payload as object }, error: null }),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [{ id: 'user-2', nome: 'Mario', cognome: 'Rossi', tipo_utente: 'cliente', avatar: null }], error: null }),
          in: vi.fn().mockResolvedValue({ data: [{ id: 'user-2', nome: 'Mario', cognome: 'Rossi', tipo_utente: 'cliente', avatar_url: null }], error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { tipo_utente: 'cliente' }, error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

function appWith(db: any) {
  return express()
    .use(express.json())
    .use('/messages', createMessagesRouter(db, {
      resolveUserMiddleware: (req: any, _res, next) => {
        req.user = { id: 'user-1', email: 'u@example.com', tipo_utente: 'cliente' };
        next();
      },
    }));
}

describe('messages routes', () => {
  it('lists chat threads', async () => {
    const res = await request(appWith(makeDb())).get('/messages/chat?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.data[0]).toHaveProperty('other_participant');
  });

  it('starts a chat thread', async () => {
    const res = await request(appWith(makeDb())).post('/messages/chat').send({ recipientId: '00000000-0000-4000-8000-000000000002' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('threadId');
  });

  it('lists chat messages', async () => {
    const res = await request(appWith(makeDb())).get('/messages/chat/thread-chat-1/messages?page=1&limit=50');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
  });

  it('sends a chat message', async () => {
    const res = await request(appWith(makeDb())).post('/messages/chat/thread-chat-1/messages').send({ content: 'Ciao!' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('content', 'Ciao!');
  });

  it('marks chat thread as read', async () => {
    const res = await request(appWith(makeDb())).post('/messages/chat/thread-chat-1/read');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('returns chat contacts', async () => {
    const res = await request(appWith(makeDb())).get('/messages/contacts');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('lists notification threads', async () => {
    const res = await request(appWith(makeDb())).get('/messages/notifications?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });

  it('returns unread count', async () => {
    const res = await request(appWith(makeDb())).get('/messages/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('count');
  });

  it('rejects start chat without body', async () => {
    const res = await request(appWith(makeDb())).post('/messages/chat').send({});
    expect(res.status).toBe(400);
  });

  it('rejects send message without content', async () => {
    const res = await request(appWith(makeDb())).post('/messages/chat/thread-chat-1/messages').send({});
    expect(res.status).toBe(400);
  });
});
