import { describe, expect, it, vi } from 'vitest';
import { acceptCompanyInvite, lookupCompanyInvite } from '../../services/company-invite-service';
import {
  createCompanyInvite,
  listCompanyInvites,
  resendCompanyInvite,
  revokeCompanyInvite,
} from '../../services/company-invite-service';

const noopMessaging = { getOrCreateNotificationThread: vi.fn(), insertSystemMessage: vi.fn() };

function makeDb(invite: Record<string, unknown> | null, inserts: unknown[] = [], updates: unknown[] = []) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: table === 'company_member_invites' ? invite : { email: 'doctor@example.com' } }),
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return { error: null };
      }),
      upsert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return { error: null };
      }),
      update: vi.fn((payload: unknown) => {
        updates.push({ table, payload });
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    })),
  };
}

function makeCompanyInviteManagementDb(state: {
  activeMember?: Record<string, unknown> | null;
  pendingInvite?: Record<string, unknown> | null;
  insertedInvite?: Record<string, unknown>;
  inviteRows?: Record<string, unknown>[];
  company?: Record<string, unknown> | null;
  existingUser?: Record<string, unknown> | null;
  count?: number;
}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];

  const db = {
    from: vi.fn((table: string) => {
      if (table === 'company_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: state.activeMember ?? null }),
          upsert: vi.fn((payload: unknown) => {
            inserts.push({ table, payload });
            return { error: null };
          }),
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
          maybeSingle: vi.fn().mockResolvedValue({
            data: state.pendingInvite ?? state.inviteRows?.[0] ?? null,
          }),
          insert: vi.fn((payload: unknown) => {
            inserts.push({ table, payload });
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: state.insertedInvite,
                error: null,
              }),
            };
          }),
          update: vi.fn((payload: unknown) => {
            updates.push({ table, payload });
            return {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { ...(state.inviteRows?.[0] ?? {}), ...(payload as Record<string, unknown>) },
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: state.company ?? { name: 'Clinica Roma' } }),
        };
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: state.existingUser ?? null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };

  return { db, inserts, updates };
}

describe('company-invite-service', () => {
  it('looks up pending company invite by token', async () => {
    const result = await lookupCompanyInvite(makeDb({
      company_id: 'company-1',
      email: 'doctor@example.com',
      nome: 'Mario',
      cognome: 'Rossi',
      role: 'member',
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
    }), 'token-1');
    expect(result).toMatchObject({ email: 'doctor@example.com', companyId: 'company-1', status: 'pending' });
  });

  it('creates membership and marks invite accepted', async () => {
    const inserts: unknown[] = [];
    const updates: unknown[] = [];
    await acceptCompanyInvite(makeDb({
      id: 'invite-1',
      company_id: 'company-1',
      email: 'doctor@example.com',
      role: 'member',
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
    }, inserts, updates), 'token-1', 'user-1');

    expect(inserts).toContainEqual(expect.objectContaining({
      table: 'company_members',
      payload: expect.objectContaining({ company_id: 'company-1', user_id: 'user-1' }),
    }));
    expect(updates).toContainEqual(expect.objectContaining({
      table: 'company_member_invites',
      payload: expect.objectContaining({ status: 'accepted', accepted_by: 'user-1' }),
    }));
  });

  it('maps platform roles to clinic membership roles', async () => {
    const inserts: unknown[] = [];
    const updates: unknown[] = [];

    const result = await acceptCompanyInvite(makeDb({
      id: 'invite-1',
      company_id: 'company-1',
      email: 'doctor@example.com',
      role: 'medico',
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
    }, inserts, updates), 'token-1', 'user-1');

    expect(result).toMatchObject({ membershipRole: 'profissional' });
  });

  it('creates company invites when the company role can invite the target role', async () => {
    const emailService = { sendCompanyInviteEmail: vi.fn().mockResolvedValue(undefined), sendInviteEmail: vi.fn() } as any;
    const insertedInvite = {
      id: '22222222-2222-4222-8222-222222222222',
      company_id: '11111111-1111-4111-8111-111111111111',
      email: 'medico@example.com',
      role: 'medico',
      status: 'pending',
      accept_token: 'token-1',
      created_at: '2026-06-25T10:00:00.000Z',
      expires_at: '2026-07-02T10:00:00.000Z',
    };
    const { db, inserts } = makeCompanyInviteManagementDb({ insertedInvite });

    const result = await createCompanyInvite(db, {
      companyId: '11111111-1111-4111-8111-111111111111',
      inviterId: 'owner-1',
      inviterCompanyRole: 'owner',
      email: 'medico@example.com',
      role: 'medico',
      nome: 'Mario',
    }, emailService, { tokenFactory: () => 'token-1', now: () => new Date('2026-06-25T10:00:00.000Z') });

    expect((inserts[0] as { table: string; payload: Record<string, unknown> }).payload).toMatchObject({
      company_id: '11111111-1111-4111-8111-111111111111',
      invited_by: 'owner-1',
      email: 'medico@example.com',
      role: 'medico',
      accept_token: 'token-1',
    });
    expect(result.acceptLink).toBe('http://localhost:3000/company/invite/accept/token-1');
    expect(emailService.sendCompanyInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      clinicName: 'Clinica Roma',
      acceptLink: 'http://localhost:3000/company/invite/accept/token-1',
    }));
  });

  it('rejects company invites when the company role cannot invite the target role', async () => {
    const { db } = makeCompanyInviteManagementDb({});

    await expect(createCompanyInvite(db, {
      companyId: '11111111-1111-4111-8111-111111111111',
      inviterId: 'patient-1',
      inviterCompanyRole: 'paciente',
      email: 'cliente@example.com',
      role: 'cliente',
    }, { sendCompanyInviteEmail: vi.fn(), sendInviteEmail: vi.fn() } as any)).rejects.toMatchObject({
      code: 'COMPANY_INVITE_FORBIDDEN',
      status: 403,
    });
  });

  it('rejects company invites for existing active members', async () => {
    const { db } = makeCompanyInviteManagementDb({ activeMember: { id: 'member-1' } });

    await expect(createCompanyInvite(db, {
      companyId: '11111111-1111-4111-8111-111111111111',
      inviterId: 'owner-1',
      inviterCompanyRole: 'owner',
      email: 'cliente@example.com',
      role: 'cliente',
    }, { sendCompanyInviteEmail: vi.fn(), sendInviteEmail: vi.fn() } as any)).rejects.toMatchObject({
      code: 'ALREADY_MEMBER',
      status: 409,
    });
  });

  it('lists company invites with accept links', async () => {
    const { db } = makeCompanyInviteManagementDb({
      count: 1,
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
    });

    const result = await listCompanyInvites(db, '11111111-1111-4111-8111-111111111111', { page: 1, limit: 20 });

    expect(result).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });
    expect(result.data[0].acceptLink).toBe('http://localhost:3000/company/invite/accept/token-1');
  });

  it('revokes pending company invites scoped to a company', async () => {
    const { db, updates } = makeCompanyInviteManagementDb({
      inviteRows: [{
        id: '22222222-2222-4222-8222-222222222222',
        company_id: '11111111-1111-4111-8111-111111111111',
        status: 'pending',
      }],
    });

    await revokeCompanyInvite(db, '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');

    expect((updates[0] as { table: string; payload: Record<string, unknown> }).payload).toMatchObject({
      status: 'revoked',
    });
  });

  it('notifies an existing user when a company invite is created for their email', async () => {
    const messagingService = {
      getOrCreateNotificationThread: vi.fn().mockResolvedValue('thread-1'),
      insertSystemMessage: vi.fn().mockResolvedValue(undefined),
    };
    const emailService = { sendCompanyInviteEmail: vi.fn().mockResolvedValue(undefined), sendInviteEmail: vi.fn() } as any;
    const insertedInvite = {
      id: '22222222-2222-4222-8222-222222222222',
      company_id: '11111111-1111-4111-8111-111111111111',
      email: 'medico@example.com',
      role: 'medico',
      status: 'pending',
      accept_token: 'token-1',
      created_at: '2026-06-25T10:00:00.000Z',
      expires_at: '2026-07-02T10:00:00.000Z',
    };
    const { db } = makeCompanyInviteManagementDb({
      insertedInvite,
      company: { name: 'Clinica Roma' },
      existingUser: { id: 'existing-user-1' },
    });

    await createCompanyInvite(db, {
      companyId: '11111111-1111-4111-8111-111111111111',
      inviterId: 'owner-1',
      inviterCompanyRole: 'owner',
      email: 'medico@example.com',
      role: 'medico',
    }, emailService, { tokenFactory: () => 'token-1', messagingService });

    expect(messagingService.getOrCreateNotificationThread).toHaveBeenCalledWith(db, ['owner-1', 'existing-user-1']);
    expect(messagingService.insertSystemMessage).toHaveBeenCalledWith(db, 'thread-1', 'owner-1', 'company_invite', {
      type: 'company_invite',
      inviteId: '22222222-2222-4222-8222-222222222222',
      clinicName: 'Clinica Roma',
      role: 'medico',
      token: 'token-1',
    });
  });

  it('notifies the inviter when a company invite is accepted', async () => {
    const messagingService = {
      getOrCreateNotificationThread: vi.fn().mockResolvedValue('thread-1'),
      insertSystemMessage: vi.fn().mockResolvedValue(undefined),
    };
    const inserts: unknown[] = [];
    const updates: unknown[] = [];

    await acceptCompanyInvite(makeDb({
      id: 'invite-1',
      company_id: 'company-1',
      invited_by: 'owner-1',
      email: 'doctor@example.com',
      role: 'medico',
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
    }, inserts, updates), 'token-1', 'user-1', { messagingService });

    expect(messagingService.getOrCreateNotificationThread).toHaveBeenCalledWith(expect.anything(), ['user-1', 'owner-1']);
    expect(messagingService.insertSystemMessage).toHaveBeenCalledWith(expect.anything(), 'thread-1', 'user-1', 'invite_accepted', expect.objectContaining({
      type: 'invite_accepted',
      inviteId: 'invite-1',
    }));
  });

  it('resends pending company invites', async () => {
    const emailService = { sendCompanyInviteEmail: vi.fn().mockResolvedValue(undefined), sendInviteEmail: vi.fn() } as any;
    const { db } = makeCompanyInviteManagementDb({
      company: { name: 'Clinica Roma' },
      inviteRows: [{
        id: '22222222-2222-4222-8222-222222222222',
        company_id: '11111111-1111-4111-8111-111111111111',
        email: 'cliente@example.com',
        role: 'cliente',
        nome: 'Mario',
        status: 'pending',
        accept_token: 'token-1',
        expires_at: '2099-01-01T00:00:00.000Z',
      }],
    });

    const result = await resendCompanyInvite(db, '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', emailService);

    expect(result.acceptLink).toBe('http://localhost:3000/company/invite/accept/token-1');
    expect(emailService.sendCompanyInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'cliente@example.com',
      clinicName: 'Clinica Roma',
    }));
  });
});
