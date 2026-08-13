import { describe, expect, it, vi } from 'vitest';
import type { SupabaseLike } from '../../db/supabase';
import {
  acceptCompanyInvite,
  createCompanyInvite,
  listCompanyInvites,
  lookupCompanyInvite,
} from '../../services/company-invite-service';

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
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

describe('canonical company invitation service', () => {
  it('looks up a pending invitation by hash without exposing email, IDs or token', async () => {
    const inviteQuery = chain({ data: baseInvite(), error: null });
    const organizationQuery = chain({ data: { display_name: 'Clinica Aurora', status: 'active' }, error: null });
    const db = { from: vi.fn((table: string) => table === 'invitations' ? inviteQuery : organizationQuery) } as unknown as SupabaseLike;

    const result = await lookupCompanyInvite(db, 'raw-token');

    expect(result).toEqual({
      organizationName: 'Clinica Aurora',
      role: 'Professionista',
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
        },
        error: null,
      }),
    } as unknown as SupabaseLike;

    const result = await acceptCompanyInvite(db, 'raw-token', 'user-1');

    expect(result).toEqual({
      organizationId: '11111111-1111-4111-8111-111111111111',
      roleCode: 'practitioner',
      alreadyMember: false,
    });
    expect((db.rpc as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('accept_organization_invitation', {
      p_token_hash: expect.any(String),
      p_user_id: 'user-1',
    });
  });

  it('creates an invitation only for a role made assignable by the database', async () => {
    const organizationQuery = chain({ data: { display_name: 'Clinica Aurora', status: 'active' }, error: null });
    const membershipQuery = chain({ data: { id: 'membership-1' }, error: null });
    const memberRolesQuery = chain({ data: [{ role_id: 'owner-role' }], error: null });
    memberRolesQuery.eq.mockResolvedValue({ data: [{ role_id: 'owner-role' }], error: null });
    const assignmentRulesQuery = chain({
      data: [{ target_role: { id: '33333333-3333-4333-8333-333333333333', code: 'practitioner', display_name: 'Professionista', scope: 'organization', is_active: true } }],
      error: null,
    });
    assignmentRulesQuery.in.mockResolvedValue({
      data: [{ target_role: { id: '33333333-3333-4333-8333-333333333333', code: 'practitioner', display_name: 'Professionista', scope: 'organization', is_active: true } }],
      error: null,
    });
    const pendingInviteQuery = chain({ data: null, error: null });
    const insertedInviteQuery = chain({ data: baseInvite(), error: null });
    const auditQuery = chain({ data: null, error: null });
    let invitationReadCount = 0;
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'organizations') return organizationQuery;
        if (table === 'organization_members') return membershipQuery;
        if (table === 'member_roles') return memberRolesQuery;
        if (table === 'organization_role_assignment_rules') return assignmentRulesQuery;
        if (table === 'invitations') {
          invitationReadCount += 1;
          return invitationReadCount === 1 ? pendingInviteQuery : insertedInviteQuery;
        }
        return auditQuery;
      }),
    } as unknown as SupabaseLike;

    const result = await createCompanyInvite(db, {
      organizationId: '11111111-1111-4111-8111-111111111111',
      inviterId: '44444444-4444-4444-8444-444444444444',
      email: 'Doctor@Example.com',
      roleId: '33333333-3333-4333-8333-333333333333',
    }, { tokenFactory: () => 'raw-token', now: () => new Date('2026-06-25T10:00:00.000Z') });

    const inserted = insertedInviteQuery.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted).toMatchObject({
      organization_id: '11111111-1111-4111-8111-111111111111',
      email: 'doctor@example.com',
      role_id: '33333333-3333-4333-8333-333333333333',
    });
    expect(inserted.token_hash).not.toBe('raw-token');
    expect(result.acceptLink).toBe('http://localhost:3000/inviti/accetta?token=raw-token');
    expect(JSON.stringify(inserted)).not.toContain('raw-token');
  });

  it('rejects a manipulated role identifier that is not assignable', async () => {
    const organizationQuery = chain({ data: { display_name: 'Clinica Aurora', status: 'active' }, error: null });
    const membershipQuery = chain({ data: { id: 'membership-1' }, error: null });
    const memberRolesQuery = chain({ data: [{ role_id: 'owner-role' }], error: null });
    memberRolesQuery.eq.mockResolvedValue({ data: [{ role_id: 'owner-role' }], error: null });
    const assignmentRulesQuery = chain({ data: [], error: null });
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'organizations') return organizationQuery;
        if (table === 'organization_members') return membershipQuery;
        if (table === 'member_roles') return memberRolesQuery;
        return assignmentRulesQuery;
      }),
    } as unknown as SupabaseLike;

    await expect(createCompanyInvite(db, {
      organizationId: '11111111-1111-4111-8111-111111111111',
      inviterId: '44444444-4444-4444-8444-444444444444',
      email: 'doctor@example.com',
      roleId: '33333333-3333-4333-8333-333333333333',
    })).rejects.toMatchObject({ code: 'INVITATION_ROLE_NOT_ASSIGNABLE', status: 403 });
  });

  it('lists organization-scoped invitations without reconstructing a raw link', async () => {
    const inviteQuery = chain({ data: [baseInvite()], count: 1, error: null });
    const db = { from: vi.fn(() => inviteQuery) } as unknown as SupabaseLike;

    const result = await listCompanyInvites(db, '11111111-1111-4111-8111-111111111111', { page: 1, limit: 20 });

    expect(result).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });
    expect(result.data[0]).toMatchObject({ organizationId: '11111111-1111-4111-8111-111111111111', role: { code: 'practitioner' } });
    expect(JSON.stringify(result)).not.toContain('acceptLink');
  });
});
