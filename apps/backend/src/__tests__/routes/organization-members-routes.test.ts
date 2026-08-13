import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseLike } from '../../db/supabase';
import { createOrganizationMembersRouter } from '../../routes/organization-members-routes';

const organizationId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    maybeSingle: async () => result,
    then: <TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return builder;
}

function createDb(permissionCode: string) {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'list_organization_members') {
      return {
        data: [{
          membership_id: membershipId,
          user_id: '33333333-3333-4333-8333-333333333333',
          email: 'doctor@example.com',
          first_name: 'Mario',
          last_name: 'Rossi',
          status: 'active',
          joined_at: '2026-08-12T10:00:00.000Z',
          roles: [{ code: 'practitioner', displayName: 'Professionista' }],
          is_organization_owner: false,
        }],
        error: null,
      };
    }
    return { data: { membership_id: membershipId, status: 'revoked' }, error: null };
  });

  const db = {
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'organizations') return query({ data: { status: 'active' }, error: null });
      if (table === 'organization_members') return query({ data: { id: 'actor-membership' }, error: null });
      if (table === 'member_roles') return query({ data: [{ role_id: 'owner-role' }], error: null });
      if (table === 'role_permissions') return query({ data: [{ permission_id: 'permission-1' }], error: null });
      if (table === 'permissions') return query({ data: [{ code: permissionCode }], error: null });
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as SupabaseLike;

  return { db, rpc };
}

function appWith(db: SupabaseLike) {
  return express()
    .use(express.json())
    .use((req, _res, next) => {
      req.companyId = organizationId;
      next();
    })
    .use('/organization/members', createOrganizationMembersRouter(db, {
      resolveUserMiddleware: (req, _res, next) => {
        req.user = { id: 'actor-user', email: 'owner@example.com', tipo_utente: 'clinica' };
        next();
      },
    }));
}

describe('organization members routes', () => {
  it('lists members only with organization.members.read', async () => {
    const { db, rpc } = createDb('organization.members.read');

    const response = await request(appWith(db)).get('/organization/members');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: [{ membershipId, email: 'doctor@example.com' }] });
    expect(rpc).toHaveBeenCalledWith('list_organization_members', { p_organization_id: organizationId });
  });

  it('does not remove a member when the actor lacks organization.members.manage', async () => {
    const { db, rpc } = createDb('organization.members.read');

    const response = await request(appWith(db)).delete(`/organization/members/${membershipId}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, code: 'FORBIDDEN' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('removes a member with organization.members.manage through the scoped RPC', async () => {
    const { db, rpc } = createDb('organization.members.manage');

    const response = await request(appWith(db)).delete(`/organization/members/${membershipId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { membershipId, status: 'revoked' } });
    expect(rpc).toHaveBeenCalledWith('remove_organization_member', {
      p_organization_id: organizationId,
      p_membership_id: membershipId,
      p_actor_user_id: 'actor-user',
    });
  });
});
