import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashInvitationToken } from '../../services/invitation-token-service';
import {
  acceptPatientInvitation,
  createPatientInvitation,
  createPatientInvitationLink,
  listPatientInvitations,
  lookupPatientInvitation,
  PatientInvitationError,
  revokePatientInvitation,
} from '../../services/patient-invitation-service';
import { getAuthorizationContext } from '../../services/authorization-context-service';

vi.mock('../../services/authorization-context-service', () => ({
  getAuthorizationContext: vi.fn(),
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const invitationId = '22222222-2222-4222-8222-222222222222';
const relationshipId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';

const user = { id: userId, email: 'owner@example.com', tipo_utente: 'clinica' } as any;
const context = { kind: 'organization' as const, id: organizationId };

function invitationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: invitationId,
    organization_id: organizationId,
    email: 'patient@example.com',
    invitation_type: 'patient_relationship',
    status: 'pending',
    expires_at: '2026-08-20T10:00:00.000Z',
    created_at: '2026-08-13T10:00:00.000Z',
    invited_by: userId,
    accepted_at: null,
    revoked_at: null,
    ...overrides,
  };
}

function queryResult(data: unknown, error: unknown = null) {
  const query: Record<string, any> = {};
  for (const method of ['select', 'eq', 'ilike', 'is', 'order', 'lte', 'update']) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  query.single = vi.fn().mockResolvedValue({ data, error });
  return query;
}

function rpcDb(result: { data?: unknown; error?: { message?: string } | null }, fromQuery?: any) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
    from: vi.fn(() => fromQuery ?? queryResult(null)),
  } as any;
}

beforeEach(() => {
  vi.mocked(getAuthorizationContext).mockReset();
  vi.mocked(getAuthorizationContext).mockResolvedValue({
    activeOperationalContext: { kind: 'organization', organizationId },
    operationalPermissions: ['patients.invite'],
  } as any);
});

describe('patient invitation service', () => {
  it('creates a hashed-token invitation and returns the raw link only to the caller', async () => {
    const rawToken = 'raw-patient-token';
    const lookup = queryResult(invitationRecord());
    const db = rpcDb({ data: invitationId, error: null }, lookup);

    const result = await createPatientInvitation(
      db,
      user,
      context,
      { email: ' Patient@Example.com ' },
      { tokenFactory: () => rawToken, now: () => new Date('2026-08-13T10:00:00.000Z') },
    );

    expect(db.rpc).toHaveBeenCalledWith('create_patient_relationship_invitation', expect.objectContaining({
      p_organization_id: organizationId,
      p_email: 'patient@example.com',
      p_invited_by: userId,
      p_token_hash: hashInvitationToken(rawToken),
    }));
    expect(db.rpc.mock.calls[0][1].p_token_hash).not.toBe(rawToken);
    expect(result.invitation.id).toBe(invitationId);
    expect(result.acceptLink).toContain(encodeURIComponent(rawToken));
  });

  it('rotates a pending invitation token and returns a link without exposing the token hash', async () => {
    const rawToken = 'rotated-patient-token';
    const db = rpcDb({ data: invitationId, error: null });

    const result = await createPatientInvitationLink(
      db,
      user,
      context,
      invitationId,
      { tokenFactory: () => rawToken },
    );

    expect(db.rpc).toHaveBeenCalledWith('rotate_patient_relationship_invitation_link', {
      p_organization_id: organizationId,
      p_invitation_id: invitationId,
      p_actor_user_id: userId,
      p_token_hash: hashInvitationToken(rawToken),
    });
    expect(db.rpc.mock.calls[0][1].p_token_hash).not.toBe(rawToken);
    expect(result.acceptLink).toContain(encodeURIComponent(rawToken));
  });

  it('maps duplicate pending invitations without creating a second record', async () => {
    const db = rpcDb({ data: null, error: { message: 'PATIENT_INVITATION_ALREADY_PENDING' } });

    await expect(createPatientInvitation(db, user, context, { email: 'patient@example.com' }))
      .rejects.toMatchObject({ code: 'PATIENT_INVITATION_ALREADY_PENDING', status: 409 });
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it('lists only patient invitations and revokes through the dedicated RPC', async () => {
    const expiryQuery = queryResult(null);
    expiryQuery.lte = vi.fn().mockResolvedValue({ error: null });
    const listQuery = queryResult([invitationRecord()]);
    listQuery.order = vi.fn().mockResolvedValue({ data: [invitationRecord()], error: null });
    const db = {
      from: vi.fn()
        .mockReturnValueOnce({ update: vi.fn(() => expiryQuery) })
        .mockReturnValueOnce(listQuery),
      rpc: vi.fn().mockResolvedValue({ data: invitationId, error: null }),
    } as any;

    const listed = await listPatientInvitations(db, user, context);
    expect(listed).toMatchObject({ total: 1, items: [{ id: invitationId, status: 'pending' }] });

    await expect(revokePatientInvitation(db, user, context, invitationId)).resolves.toEqual({
      id: invitationId,
      status: 'revoked',
    });
    expect(db.rpc).toHaveBeenCalledWith('revoke_patient_relationship_invitation', {
      p_organization_id: organizationId,
      p_invitation_id: invitationId,
      p_actor_user_id: userId,
    });
  });

  it.each([
    ['revoked', 'PATIENT_INVITATION_REVOKED'],
    ['accepted', 'PATIENT_INVITATION_ALREADY_ACCEPTED'],
    ['expired', 'PATIENT_INVITATION_EXPIRED'],
  ] as const)('rejects a %s invitation during lookup', async (status, code) => {
    const db = rpcDb({ data: invitationRecord({ status }), error: null }, queryResult(invitationRecord({ status })));
    await expect(lookupPatientInvitation(db, 'token')).rejects.toMatchObject({ code });
  });

  it('rejects a member token on the patient lookup route', async () => {
    const db = rpcDb({ data: invitationRecord({ invitation_type: 'organization_member' }), error: null }, queryResult(invitationRecord({ invitation_type: 'organization_member' })));
    await expect(lookupPatientInvitation(db, 'member-token')).rejects.toMatchObject({
      code: 'PATIENT_INVITATION_NOT_FOUND',
      status: 404,
    });
  });

  it('accepts atomically through the patient RPC and never calls membership or context writes', async () => {
    const organizationQuery = queryResult({ display_name: 'Clinica Roma', status: 'active' });
    const db = rpcDb({
      data: {
        organization_id: organizationId,
        relationship_id: relationshipId,
        relationship_reactivated: true,
      },
      error: null,
    }, organizationQuery);

    const result = await acceptPatientInvitation(db, 'raw-token', user);

    expect(result).toEqual({
      organizationName: 'Clinica Roma',
      relationshipId,
      relationshipReactivated: true,
    });
    expect(db.rpc).toHaveBeenCalledWith('accept_patient_relationship_invitation', {
      p_token_hash: hashInvitationToken('raw-token'),
      p_user_id: userId,
    });
    expect(db.from).not.toHaveBeenCalledWith('organization_members');
    expect(db.from).not.toHaveBeenCalledWith('member_roles');
  });

  it('preserves email mismatch as a security error from the atomic RPC', async () => {
    const db = rpcDb({ data: null, error: { message: 'PATIENT_INVITATION_EMAIL_MISMATCH' } });
    await expect(acceptPatientInvitation(db, 'raw-token', user)).rejects.toEqual(
      expect.objectContaining({
        code: 'PATIENT_INVITATION_EMAIL_MISMATCH',
        status: 403,
      } satisfies Partial<PatientInvitationError>),
    );
  });
});
