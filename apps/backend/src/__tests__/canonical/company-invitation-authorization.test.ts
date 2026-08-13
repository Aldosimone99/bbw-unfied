import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { SupabaseLike } from '../../db/supabase';
import { requireCompanyPermission } from '../../middleware/require-company-permission-middleware';

type QueryChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function query(result: unknown): QueryChain {
  const builder = {} as QueryChain;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

function responseSpy() {
  const response = {} as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  return response;
}

function authorizedDb(permissionCodes: string[]): SupabaseLike {
  const organizationQuery = query({ data: { status: 'active' }, error: null });
  const membershipQuery = query({ data: { id: 'membership-a' }, error: null });
  const memberRolesQuery = query({ data: [{ role_id: 'role-owner' }], error: null });
  memberRolesQuery.eq.mockResolvedValue({ data: [{ role_id: 'role-owner' }], error: null });
  const rolePermissionsQuery = query({ data: [{ permission_id: 'permission-invite' }], error: null });
  rolePermissionsQuery.in.mockResolvedValue({ data: [{ permission_id: 'permission-invite' }], error: null });
  const permissionsQuery = query({ data: permissionCodes.map((code) => ({ code })), error: null });
  permissionsQuery.in.mockResolvedValue({ data: permissionCodes.map((code) => ({ code })), error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === 'organizations') return organizationQuery;
      if (table === 'organization_members') return membershipQuery;
      if (table === 'member_roles') return memberRolesQuery;
      if (table === 'role_permissions') return rolePermissionsQuery;
      return permissionsQuery;
    }),
  } as unknown as SupabaseLike;
}

function requestFor(organizationId: string): Request {
  return {
    companyId: organizationId,
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'owner@example.com', tipo_utente: 'privato' },
  } as unknown as Request;
}

describe('organization invitation authorization', () => {
  it('allows an active organization membership only when it has the canonical invite permission', async () => {
    const middleware = requireCompanyPermission(authorizedDb(['organization.members.invite']), 'organization.members.invite');
    const response = responseSpy();
    const next = vi.fn();

    await middleware(requestFor('11111111-1111-4111-8111-111111111111'), response as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects an active membership without the invite permission', async () => {
    const middleware = requireCompanyPermission(authorizedDb(['organization.members.read']), 'organization.members.invite');
    const response = responseSpy();
    const next = vi.fn();

    await middleware(requestFor('11111111-1111-4111-8111-111111111111'), response as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ success: false, code: 'FORBIDDEN' });
  });

  it('rejects a cross-organization context without a membership', async () => {
    const organizationQuery = query({ data: { status: 'active' }, error: null });
    const membershipQuery = query({ data: null, error: null });
    const db = {
      from: vi.fn((table: string) => table === 'organizations' ? organizationQuery : membershipQuery),
    } as unknown as SupabaseLike;
    const middleware = requireCompanyPermission(db, 'organization.members.invite');
    const response = responseSpy();
    const next = vi.fn();

    await middleware(requestFor('22222222-2222-4222-8222-222222222222'), response as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ success: false, code: 'FORBIDDEN' });
  });
});
