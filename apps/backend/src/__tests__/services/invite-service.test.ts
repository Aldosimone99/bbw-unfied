import { describe, expect, it, vi } from 'vitest';
import {
  createInvite,
  listInvites,
  lookupInviteByToken,
  redeemInviteCode,
  resendInvite,
  revokeInvite,
  validateInviteCode,
} from '../../services/invite-service';

function makeDb(invite: Record<string, unknown> | null, updates: unknown[] = []) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'invites') throw new Error(`unexpected table ${table}`);
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: invite }),
        update: vi.fn((payload: unknown) => {
          updates.push(payload);
          return { eq: vi.fn().mockResolvedValue({ error: null }) };
        }),
      };
    }),
  };
}

describe('invite-service', () => {
  it('looks up a pending invite by token without consuming it', async () => {
    const invite = {
      code: 'INV-ABC123',
      accept_token: 'token-1',
      email: 'mario@example.com',
      type: 'cliente',
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
    };
    const result = await lookupInviteByToken(makeDb(invite), 'token-1');
    expect(result).toMatchObject({ valid: true, code: 'INV-ABC123', email: 'mario@example.com' });
  });

  it('rejects expired invite codes', async () => {
    const invite = {
      code: 'INV-OLD',
      email: 'old@example.com',
      type: 'cliente',
      status: 'pending',
      expires_at: '2000-01-01T00:00:00.000Z',
    };
    await expect(validateInviteCode(makeDb(invite), 'INV-OLD')).rejects.toMatchObject({ code: 'INVITE_EXPIRED' });
  });

  it('marks invite used during redemption', async () => {
    const updates: unknown[] = [];
    const invite = {
      code: 'INV-ABC123',
      email: 'mario@example.com',
      type: 'cliente',
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
    };
    await redeemInviteCode(makeDb(invite, updates), 'INV-ABC123', 'user-1');
    expect(updates[0]).toMatchObject({ status: 'used', used_by: 'user-1' });
  });
});

function makeInviteManagementDb(state: {
  existingUser?: Record<string, unknown> | null;
  insertedInvite?: Record<string, unknown>;
  inviteRows?: Record<string, unknown>[];
  count?: number;
  updateError?: unknown;
}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const calls: string[] = [];

  const db = {
    from: vi.fn((table: string) => {
      calls.push(table);
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
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
          insert: vi.fn((payload: unknown) => {
            inserts.push(payload);
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: state.insertedInvite,
                error: null,
              }),
            };
          }),
          update: vi.fn((payload: unknown) => {
            updates.push(payload);
            return {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { ...(state.inviteRows?.[0] ?? {}), ...(payload as Record<string, unknown>) },
                error: state.updateError ?? null,
              }),
            };
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };

  return { db, inserts, updates, calls };
}

describe('invite management', () => {
  it('creates an invite when the owner role can invite the target role', async () => {
    const emailService = { sendInviteEmail: vi.fn().mockResolvedValue(undefined), sendCompanyInviteEmail: vi.fn() } as any;
    const insertedInvite = {
      id: '11111111-1111-4111-8111-111111111111',
      code: 'INV-ABC123',
      email: 'cliente@example.com',
      type: 'cliente',
      status: 'pending',
      accept_token: 'token-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      created_at: '2026-06-25T10:00:00.000Z',
    };
    const { db, inserts } = makeInviteManagementDb({ insertedInvite });

    const result = await createInvite(db, 'owner-1', 'medico', {
      email: 'cliente@example.com',
      type: 'cliente',
      nome: 'Mario',
    }, { emailService, tokenFactory: () => 'token-1', now: () => new Date('2026-06-25T10:00:00.000Z') });

    expect(inserts[0]).toMatchObject({
      email: 'cliente@example.com',
      type: 'cliente',
      owner_id: 'owner-1',
      status: 'pending',
      accept_token: 'token-1',
    });
    expect(result.acceptLink).toBe('http://localhost:3000/invite/accept/token-1');
    expect(emailService.sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'cliente@example.com',
      acceptLink: 'http://localhost:3000/invite/accept/token-1',
    }));
  });

  it('blocks invite creation when the target email already exists unless forced', async () => {
    const { db } = makeInviteManagementDb({ existingUser: { id: 'user-1' } });

    await expect(createInvite(db, 'owner-1', 'medico', {
      email: 'cliente@example.com',
      type: 'cliente',
    })).rejects.toMatchObject({ code: 'INVITE_EMAIL_ALREADY_EXISTS', status: 409 });
  });

  it('rejects disallowed owner role and target role pairs', async () => {
    const { db } = makeInviteManagementDb({});

    await expect(createInvite(db, 'owner-1', 'cliente', {
      email: 'medico@example.com',
      type: 'medico',
    })).rejects.toMatchObject({ code: 'INVITE_FORBIDDEN', status: 403 });
  });

  it('lists owner-scoped invites with pagination metadata', async () => {
    const { db } = makeInviteManagementDb({
      count: 21,
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
    });

    const result = await listInvites(db, 'owner-1', { page: 2, limit: 20 });

    expect(result).toMatchObject({ total: 21, page: 2, limit: 20, pages: 2 });
    expect(result.data[0].acceptLink).toBe('http://localhost:3000/invite/accept/token-1');
  });

  it('revokes only pending owner-scoped invites', async () => {
    const { db, updates } = makeInviteManagementDb({
      inviteRows: [{
        id: '11111111-1111-4111-8111-111111111111',
        status: 'pending',
        owner_id: 'owner-1',
      }],
    });

    await revokeInvite(db, '11111111-1111-4111-8111-111111111111', 'owner-1');

    expect(updates[0]).toMatchObject({ status: 'revoked' });
  });

  it('resends a pending invite email and returns the accept link', async () => {
    const emailService = { sendInviteEmail: vi.fn().mockResolvedValue(undefined), sendCompanyInviteEmail: vi.fn() } as any;
    const { db } = makeInviteManagementDb({
      inviteRows: [{
        id: '11111111-1111-4111-8111-111111111111',
        email: 'cliente@example.com',
        nome: 'Mario',
        type: 'cliente',
        status: 'pending',
        accept_token: 'token-1',
        expires_at: '2099-01-01T00:00:00.000Z',
      }],
    });

    const result = await resendInvite(db, '11111111-1111-4111-8111-111111111111', 'owner-1', emailService);

    expect(result.acceptLink).toBe('http://localhost:3000/invite/accept/token-1');
    expect(emailService.sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'cliente@example.com',
    }));
  });
});
