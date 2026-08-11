import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createNotificationsRouter } from '../../routes/notifications-routes';

function makeDb() {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: null, count: 0, error: null }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: table === 'message_threads'
          ? [{ id: 'thread-1', participant_ids: ['user-1'], updated_at: '2026-06-25T10:00:00.000Z' }]
          : [{ id: 'message-1', thread_id: 'thread-1', sender_id: 'user-2', type: 'system', created_at: '2026-06-25T10:00:00.000Z' }],
        count: 1,
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'thread-1', participant_ids: ['user-1'] } }),
      update: vi.fn(() => ({ eq: vi.fn().mockReturnThis(), not: vi.fn().mockResolvedValue({ error: null }) })),
    })),
  };
}

function appWith(db: any) {
  return express()
    .use(express.json())
    .use('/notifications', createNotificationsRouter(db, {
      resolveUserMiddleware: (req, _res, next) => {
        req.user = { id: 'user-1', email: 'u@example.com', tipo_utente: 'cliente' };
        next();
      },
    }));
}

describe('notifications routes', () => {
  it('lists notification threads', async () => {
    const res = await request(appWith(makeDb())).get('/notifications?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 1, page: 1, limit: 20 });
  });

  it('returns unread count', async () => {
    const res = await request(appWith(makeDb())).get('/notifications/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('count');
  });

  it('gets thread messages', async () => {
    const res = await request(appWith(makeDb())).get('/notifications/thread-1?page=1&limit=50');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
  });

  it('marks a thread as read', async () => {
    const res = await request(appWith(makeDb())).post('/notifications/thread-1/read');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
