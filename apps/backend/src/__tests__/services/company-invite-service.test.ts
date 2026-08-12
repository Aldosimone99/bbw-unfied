import { describe, expect, it, vi } from 'vitest';
import {
  acceptCompanyInvite,
  createCompanyInvite,
  listCompanyInvites,
  lookupCompanyInvite,
} from '../../services/company-invite-service';

function chain(result: unknown = { data: null, error: null }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    insert: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
  };
  return builder;
}

function baseInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    organization_id: '11111111-1111-4111-8111-111111111111',
    email: 'doctor@example.com',
    role_id: 'role-practitioner',
    token_hash: 'hash',
    status: 'pending',
    expires_at: '2099-01-01T00:00:00.000Z',
    invited_by: 'owner-1',
    roles: { id: 'role-practitioner', code: 'practitioner', display_name: 'Practitioner' },
    ...overrides,
  };
}

describe('canonical company invitation service', () => {
  it('looks up an invitation by hash without exposing the stored token', async () => {
    const inviteQuery = chain({ data: baseInvite(), error: null });
    const organizationQuery = chain({ data: { display_name: 'Clinica Roma' }, error: null });
    const db = { from: vi.fn((table: string) => table === 'invitations' ? inviteQuery : organizationQuery) } as any;

    const result = await lookupCompanyInvite(db, 'raw-token');

    expect(result).toMatchObject({
      email: 'doctor@example.com',
      companyId: '11111111-1111-4111-8111-111111111111',
      companyName: 'Clinica Roma',
      role: 'medico',
      status: 'pending',
    });
    expect(inviteQuery.eq).toHaveBeenCalledWith('token_hash', expect.any(String));
  });

  it('accepts an invitation only for the invited account email', async () => {
    const db = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          organization_id: '11111111-1111-4111-8111-111111111111',
          role_code: 'practitioner',
          already_member: false,
        },
        error: null,
      }),
    } as any;

    const result = await acceptCompanyInvite(db, 'raw-token', 'user-1');

    expect(result).toMatchObject({ companyId: '11111111-1111-4111-8111-111111111111', role: 'medico', membershipRole: 'practitioner' });
    expect(db.rpc).toHaveBeenCalledWith('accept_organization_invitation', {
      p_token_hash: expect.any(String),
      p_user_id: 'user-1',
    });
  });

  it('creates canonical invitations with a hashed token and contextual role', async () => {
    const organizationQuery = chain({ data: { id: 'org-1', status: 'active' }, error: null });
    const roleQuery = chain({ data: { id: 'role-practitioner' }, error: null });
    const pendingQuery = chain({ data: null, error: null });
    const invitationQuery = chain({ data: baseInvite({ organization_id: 'org-1', id: 'invite-1' }), error: null });
    const auditQuery = chain({ data: null, error: null });
    const emailService = { sendCompanyInviteEmail: vi.fn().mockResolvedValue(undefined) } as any;
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'organizations') return organizationQuery;
        if (table === 'roles') return roleQuery;
        if (table === 'invitations') return pendingQuery.maybeSingle.mock.calls.length ? invitationQuery : pendingQuery;
        if (table === 'audit_events') return auditQuery;
        return chain();
      }),
    } as any;

    const result = await createCompanyInvite(db, {
      companyId: 'org-1',
      inviterId: 'owner-1',
      inviterCompanyRole: 'organization_owner',
      email: 'Doctor@Example.com',
      role: 'medico',
      nome: 'Mario',
    }, emailService, { tokenFactory: () => 'raw-token', now: () => new Date('2026-06-25T10:00:00.000Z') });

    const inserted = invitationQuery.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted).toMatchObject({ organization_id: 'org-1', email: 'doctor@example.com', role_id: 'role-practitioner', invitee_first_name: 'Mario' });
    expect(inserted.token_hash).not.toBe('raw-token');
    expect(result.acceptLink).toBe('http://localhost:3000/company/invite/accept/raw-token');
    expect(emailService.sendCompanyInviteEmail).toHaveBeenCalledWith(expect.objectContaining({ role: 'medico', acceptLink: result.acceptLink }));
  });

  it('lists canonical invitations with pagination', async () => {
    const inviteQuery = chain({ data: [baseInvite()], count: 1, error: null });
    const db = { from: vi.fn(() => inviteQuery) } as any;
    const result = await listCompanyInvites(db, 'org-1', { page: 1, limit: 20 });
    expect(result).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 });
    expect(result.data[0]).toMatchObject({ company_id: '11111111-1111-4111-8111-111111111111', role: 'medico' });
  });

  it('rejects invite creation from a non-managerial membership role', async () => {
    const db = { from: vi.fn() } as any;
    await expect(createCompanyInvite(db, {
      companyId: 'org-1',
      inviterId: 'customer-1',
      inviterCompanyRole: 'customer',
      email: 'client@example.com',
      role: 'cliente',
    }, { sendCompanyInviteEmail: vi.fn() } as any)).rejects.toMatchObject({ code: 'COMPANY_INVITE_FORBIDDEN', status: 403 });
  });
});
