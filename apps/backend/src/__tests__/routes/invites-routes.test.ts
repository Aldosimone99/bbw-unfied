import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createInvitesRouter } from '../../routes/invites-routes';

function appWithInvite(invite: Record<string, unknown> | null) {
  const db = {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: invite }),
    })),
  };
  return express().use(express.json()).use('/invites', createInvitesRouter(db));
}

function makeRouteDb(state: {
  existingUser?: Record<string, unknown> | null;
  insertedInvite?: Record<string, unknown>;
  inviteRows?: Record<string, unknown>[];
  count?: number;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'owner-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'owner-1', email: 'owner@example.com', tipo_utente: 'medico' },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: state.existingUser ?? null }),
        };
      }
      if (table === 'invites') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: state.inviteRows ?? [],
            count: state.count ?? (state.inviteRows ?? []).length,
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: state.inviteRows?.[0] ?? state.insertedInvite ?? null,
          }),
          insert: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: state.insertedInvite,
              error: null,
            }),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: state.inviteRows?.[0] ?? null,
              error: null,
            }),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

function authedApp(db: any, user = { id: 'owner-1', tipo_utente: 'medico' as const, email: 'owner@example.com' }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/invites', createInvitesRouter(db, { resolveUserMiddleware: (_req, _res, next) => next() }));
  return app;
}

describe('invites routes', () => {
  it('looks up invite token without consuming it', async () => {
    const res = await request(appWithInvite({
      code: 'INV-ABC123',
      email: 'mario@example.com',
      type: 'cliente',
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
    })).get('/invites/accept/token-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ code: 'INV-ABC123', email: 'mario@example.com' });
  });

  it('creates an invite for the authenticated owner', async () => {
    const db = makeRouteDb({
      insertedInvite: {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'INV-ABC123',
        email: 'cliente@example.com',
        type: 'cliente',
        status: 'pending',
        accept_token: 'token-1',
        created_at: '2026-06-25T10:00:00.000Z',
        expires_at: '2099-01-01T00:00:00.000Z',
      },
    });

    const res = await request(authedApp(db))
      .post('/invites')
      .send({ email: 'cliente@example.com', type: 'cliente' });

    expect(res.status).toBe(201);
    expect(res.body.data.acceptLink).toContain('/invite/accept/');
  });

  it('returns 409 when invite target email already exists', async () => {
    const db = makeRouteDb({ existingUser: { id: 'user-1' } });

    const res = await request(authedApp(db))
      .post('/invites')
      .send({ email: 'cliente@example.com', type: 'cliente' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 'INVITE_EMAIL_ALREADY_EXISTS',
      exists: true,
    });
  });

  it('lists authenticated owner invites', async () => {
    const db = makeRouteDb({
      inviteRows: [{
        id: '11111111-1111-4111-8111-111111111111',
        code: 'INV-ABC123',
        email: 'cliente@example.com',
        type: 'cliente',
        status: 'pending',
        accept_token: 'token-1',
        created_at: '2026-06-25T10:00:00.000Z',
        expires_at: '2099-01-01T00:00:00.000Z',
      }],
      count: 1,
    });

    const res = await request(authedApp(db)).get('/invites?page=1&limit=20');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 1, page: 1, limit: 20 });
  });

  it('revokes authenticated owner pending invites', async () => {
    const db = makeRouteDb({
      inviteRows: [{
        id: '11111111-1111-4111-8111-111111111111',
        status: 'pending',
        owner_id: 'owner-1',
        email: 'cliente@example.com',
        type: 'cliente',
        code: 'INV-ABC123',
        expires_at: '2099-01-01T00:00:00.000Z',
      }],
    });

    const res = await request(authedApp(db)).delete('/invites/11111111-1111-4111-8111-111111111111');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
