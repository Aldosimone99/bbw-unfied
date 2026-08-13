import { describe, expect, it, vi } from 'vitest';
import type { SupabaseLike } from '../../db/supabase';
import {
  acceptCompanyInvite,
  clearCompanyInviteHistory,
  createCompanyInvite,
  hideCompanyInviteFromHistory,
  listCompanyInvites,
  lookupCompanyInvite,
} from '../../services/company-invite-service';

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function chain(result: unknown = { data: null, error: null }): MockChain {
  const builder = {} as MockChain;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.ilike = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.range = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  return builder;
}

function baseInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    organization_id: '11111111-1111-4111-8111-111111111111',
    email: 'doctor@example.com',
    role_id: '33333333-3333-4333-8333-333333333333',
    status: 'pending',
    expires_at: '2099-01-01T00:00:00.000Z',
    created_at: '2026-06-25T10:00:00.000Z',
    invited_by: '44444444-4444-4444-8444-444444444444',
    accepted_at: null,
    revoked_at: null,
    roles: { id: '33333333-3333-4333-8333-333333333333', code: 'practitioner', display_name: 'Professionista' },
    ...overrides,
  };
}

const practitionerRole = {
  id: '33333333-3333-4333-8333-333333333333',
  code: 'practitioner',
  display_name: 'Professionista',
  scope: 'organization',
  is_active: true,
};

describe('canonical company invitation service', () => {
  it('looks up a pending invitation by hash without exposing email, IDs or token', async () => {
    const inviteQuery = chain({ data: baseInvite(), error: null });
    const organizationQuery = chain({ data: { display_name: 'Clinica Aurora', status: 'active' }, error: null });
    const db = { from: vi.fn((table: string) => table === 'invitations' ? inviteQuery : organizationQuery) } as unknown as SupabaseLike;

    const result = await lookupCompanyInvite(db, 'raw-token');

    expect(result).toEqual({
      organizationName: 'Clinica Aurora',
      role: 'Medico',
      expiresAt: '2099-01-01T00:00:00.000Z',
      status: 'pending',
    });
    expect(inviteQuery.eq).toHaveBeenCalledWith('token_hash', expect.any(String));
    expect(JSON.stringify(result)).not.toContain('raw-token');
    expect(JSON.stringify(result)).not.toContain('doctor@example.com');
  });

  it.each([
    ['INVITATION_EXPIRED', 'INVITATION_EXPIRED'],
    ['INVITATION_REVOKED', 'INVITATION_REVOKED'],
    ['INVITATION_ALREADY_ACCEPTED', 'INVITATION_ALREADY_ACCEPTED'],
    ['INVITATION_EMAIL_MISMATCH', 'INVITATION_EMAIL_MISMATCH'],
    ['MEMBERSHIP_ALREADY_EXISTS', 'MEMBERSHIP_ALREADY_EXISTS'],
    ['INVITATION_ROLE_NOT_MEDICAL', 'INVITATION_ROLE_NOT_MEDICAL'],
    ['INVITATION_RECIPIENT_NOT_PHYSICIAN', 'INVITATION_RECIPIENT_NOT_PHYSICIAN'],
  ])('maps the atomic acceptance error %s', async (databaseError, expectedCode) => {
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: databaseError } }),
    } as unknown as SupabaseLike;

    await expect(acceptCompanyInvite(db, 'raw-token', 'user-1')).rejects.toMatchObject({ code: expectedCode });
  });

  it('accepts through the transaction RPC using only a token hash and authenticated account', async () => {
    const db = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          organization_id: '11111111-1111-4111-8111-111111111111',
          role_code: 'practitioner',
          already_member: false,
          membership_reactivated: true,
        },
        error: null,
      }),
    } as unknown as SupabaseLike;

    const result = await acceptCompanyInvite(db, 'raw-token', 'user-1');

    expect(result).toEqual({
      organizationId: '11111111-1111-4111-8111-111111111111',
      roleCode: 'practitioner',
      alreadyMember: false,
      membershipReactivated: true,
    });
    expect((db.rpc as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('accept_organization_invitation', {
      p_token_hash: expect.any(String),
      p_user_id: 'user-1',
    });
  });

  it('creates a medical practitioner invitation after resolving the role server-side', async () => {
    const organizationQuery = chain({ data: { display_name: 'Clinica Aurora', status: 'active' }, error: null });
    const practitionerRoleQuery = chain({ data: practitionerRole, error: null });
    const membershipQuery = chain({ data: { id: 'membership-1' }, error: null });
    const memberRolesQuery = chain({ data: [{ role_id: 'owner-role' }], error: null });
    memberRolesQuery.eq.mockResolvedValue({ data: [{ role_id: 'owner-role' }], error: null });
    const assignmentRulesQuery = chain({ data: [{ target_role: practitionerRole }], error: null });
    assignmentRulesQuery.in.mockResolvedValue({ data: [{ target_role: practitionerRole }], error: null });
    const pendingInviteQuery = chain({ data: null, error: null });
    const expiredInviteQuery = chain({ data: null, error: null });
    const insertedInviteQuery = chain({ data: baseInvite(), error: null });
    const auditQuery = chain({ data: null, error: null });
    let invitationReadCount = 0;
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'organizations') return organizationQuery;
        if (table === 'roles') return practitionerRoleQuery;
        if (table === 'organization_members') return membershipQuery;
        if (table === 'member_roles') return memberRolesQuery;
        if (table === 'organization_role_assignment_rules') return assignmentRulesQuery;
        if (table === 'invitations') {
          invitationReadCount += 1;
          if (invitationReadCount === 1) return expiredInviteQuery;
          return invitationReadCount === 2 ? pendingInviteQuery : insertedInviteQuery;
        }
        return auditQuery;
      }),
    } as unknown as SupabaseLike;

    const result = await createCompanyInvite(db, {
      organizationId: '11111111-1111-4111-8111-111111111111',
      inviterId: '44444444-4444-4444-8444-444444444444',
      email: 'Doctor@Example.com',
    }, { tokenFactory: () => 'raw-token', now: () => new Date('2026-06-25T10:00:00.000Z') });

    const inserted = insertedInviteQuery.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(practitionerRoleQuery.eq).toHaveBeenCalledWith('code', 'practitioner');
    expect(inserted).toMatchObject({
      organization_id: '11111111-1111-4111-8111-111111111111',
      email: 'doctor@example.com',
      role_id: '33333333-3333-4333-8333-333333333333',
    });
    expect(inserted.token_hash).not.toBe('raw-token');
    expect(result.acceptLink).toBe('http://localhost:3000/inviti/accetta?token=raw-token');
    expect(JSON.stringify(inserted)).not.toContain('raw-token');
  });

  it('rejects a medical invitation when the server-resolved practitioner role is not assignable', async () => {
    const organizationQuery = chain({ data: { display_name: 'Clinica Aurora', status: 'active' }, error: null });
    const practitionerRoleQuery = chain({ data: practitionerRole, error: null });
    const membershipQuery = chain({ data: { id: 'membership-1' }, error: null });
    const memberRolesQuery = chain({ data: [{ role_id: 'owner-role' }], error: null });
    memberRolesQuery.eq.mockResolvedValue({ data: [{ role_id: 'owner-role' }], error: null });
    const assignmentRulesQuery = chain({ data: [], error: null });
    assignmentRulesQuery.in.mockResolvedValue({ data: [], error: null });
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'organizations') return organizationQuery;
        if (table === 'roles') return practitionerRoleQuery;
        if (table === 'organization_members') return membershipQuery;
        if (table === 'member_roles') return memberRolesQuery;
        return assignmentRulesQuery;
      }),
    } as unknown as SupabaseLike;

    await expect(createCompanyInvite(db, {
      organizationId: '11111111-1111-4111-8111-111111111111',
      inviterId: '44444444-4444-4444-8444-444444444444',
      email: 'doctor@example.com',
    })).rejects.toMatchObject({ code: 'INVITATION_ROLE_NOT_ASSIGNABLE', status: 403 });
  });

  it('lists organization-scoped invitations without reconstructing a raw link', async () => {
    const expiredInviteQuery = chain({ data: null, error: null });
    const inviteQuery = chain({ data: [baseInvite()], count: 1, error: null });
    let invitationQueryCount = 0;
    const db = {
      from: vi.fn(() => {
        invitationQueryCount += 1;
        return invitationQueryCount === 1 ? expiredInviteQuery : inviteQuery;
      }),
    } as unknown as SupabaseLike;

    const result = await listCompanyInvites(db, '11111111-1111-4111-8111-111111111111', { page: 1, limit: 20 });

    expect(result).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });
    expect(result.data[0]).toMatchObject({ organizationId: '11111111-1111-4111-8111-111111111111', role: { code: 'practitioner' } });
    expect(inviteQuery.is).toHaveBeenCalledWith('hidden_from_history_at', null);
    expect(JSON.stringify(result)).not.toContain('acceptLink');
  });

  it('hides only a completed invitation through the organization-scoped history RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    await expect(hideCompanyInviteFromHistory(
      { rpc } as unknown as SupabaseLike,
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444',
    )).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('hide_organization_invitation_from_history', {
      p_organization_id: '11111111-1111-4111-8111-111111111111',
      p_invitation_id: '22222222-2222-4222-8222-222222222222',
      p_actor_user_id: '44444444-4444-4444-8444-444444444444',
    });
  });

  it('rejects history hiding for a pending invitation and clears only completed history', async () => {
    const pendingRpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'INVITATION_PENDING_HISTORY_HIDE_NOT_ALLOWED' } });
    await expect(hideCompanyInviteFromHistory(
      { rpc: pendingRpc } as unknown as SupabaseLike,
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444',
    )).rejects.toMatchObject({ code: 'INVITATION_PENDING_HISTORY_HIDE_NOT_ALLOWED', status: 422 });

    const clearRpc = vi.fn().mockResolvedValue({ data: 3, error: null });
    await expect(clearCompanyInviteHistory(
      { rpc: clearRpc } as unknown as SupabaseLike,
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444',
    )).resolves.toEqual({ hiddenCount: 3 });
  });
});
