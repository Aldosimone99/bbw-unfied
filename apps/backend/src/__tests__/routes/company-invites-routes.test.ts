import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createCompanyInvitesRouter } from '../../routes/company-invites-routes';
import { resolveCompanyContext } from '../../middleware/resolve-company-context-middleware';

function makeRouteDb(state: {
  member?: Record<string, unknown> | null;
  queryCounts?: Record<string, number>;
  pendingInvite?: Record<string, unknown> | null;
  insertedInvite?: Record<string, unknown>;
  inviteRows?: Record<string, unknown>[];
  company?: Record<string, unknown> | null;
  count?: number;
}) {
  const memberQueries: (() => Record<string, unknown> | null)[] = [
    () => state.member ?? { role: 'owner' },  // first company_members query (middleware)
    () => null,                                 // second query (service active member check)
  ];
  const memberQueryFn = vi.fn(() => {
    const value = memberQueries.shift()?.() ?? null;
    return { data: value };
  });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'owner-1', email: 'owner@example.com', tipo_utente: 'clinica' },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'company_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(memberQueryFn),
        };
      }
      if (table === 'company_member_invites') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: state.inviteRows ?? [],
            count: state.count ?? (state.inviteRows ?? []).length,
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: state.pendingInvite ?? state.inviteRows?.[0] ?? null }),
          insert: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: state.insertedInvite, error: null }),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: state.inviteRows?.[0] ?? null, error: null }),
          })),
        };
      }
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: state.company ?? { name: 'Clinica Roma' } }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

function appWith(db: any) {
  return express()
    .use(express.json())
    .use(resolveCompanyContext)
    .use('/company/invites', createCompanyInvitesRouter(db, {
      resolveUserMiddleware: (req, _res, next) => {
        req.user = { id: 'owner-1', email: 'owner@example.com', tipo_utente: 'clinica' };
        next();
      },
    }));
}

describe('company invite routes', () => {
  it('returns 422 when accept is missing token', async () => {
    const app = express().use(express.json()).use('/company/invites', createCompanyInvitesRouter({ from: vi.fn() }, {
      resolveUserMiddleware: (req, _res, next) => {
        req.user = { id: 'user-1', email: 'user@example.com', tipo_utente: 'medico' };
        next();
      },
    }));
    const res = await request(app).post('/company/invites/accept').send({ userId: 'user-1' });
    expect(res.status).toBe(422);
  });

  it('creates company invites for authorized company members', async () => {
    const db = makeRouteDb({
      insertedInvite: {
        id: '22222222-2222-4222-8222-222222222222',
        company_id: '11111111-1111-4111-8111-111111111111',
        email: 'medico@example.com',
        role: 'medico',
        status: 'pending',
        accept_token: 'token-1',
        created_at: '2026-06-25T10:00:00.000Z',
        expires_at: '2026-07-02T10:00:00.000Z',
      },
    });

    const res = await request(appWith(db))
      .post('/company/invites')
      .set('X-Company-Id', '11111111-1111-4111-8111-111111111111')
      .send({
        email: 'medico@example.com',
        role: 'medico',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.acceptLink).toContain('/company/invite/accept/');
  });

  it('lists company invites with pagination', async () => {
    const db = makeRouteDb({
      inviteRows: [{
        id: '22222222-2222-4222-8222-222222222222',
        company_id: '11111111-1111-4111-8111-111111111111',
        email: 'cliente@example.com',
        role: 'cliente',
        status: 'pending',
        accept_token: 'token-1',
        created_at: '2026-06-25T10:00:00.000Z',
        expires_at: '2026-07-02T10:00:00.000Z',
      }],
      count: 1,
    });

    const res = await request(appWith(db))
      .get('/company/invites?page=1&limit=20')
      .set('X-Company-Id', '11111111-1111-4111-8111-111111111111');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 1, page: 1, limit: 20 });
  });

  it('revokes company invites', async () => {
    const db = makeRouteDb({
      inviteRows: [{
        id: '22222222-2222-4222-8222-222222222222',
        company_id: '11111111-1111-4111-8111-111111111111',
        status: 'pending',
      }],
    });

    const res = await request(appWith(db))
      .delete('/company/invites/22222222-2222-4222-8222-222222222222')
      .set('X-Company-Id', '11111111-1111-4111-8111-111111111111')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
