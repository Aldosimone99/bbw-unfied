import type {
  CreatePatientInvitationRequest,
  OperationalContextReference,
  PatientInvitation,
  PatientInvitationAcceptResponse,
  PatientInvitationLookupResponse,
  PatientInvitationListResponse,
} from '@bbw/interfaces';
import {
  patientInvitationAcceptResponseSchema,
  patientInvitationListResponseSchema,
  patientInvitationSchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { getAuthorizationContext } from './authorization-context-service';
import {
  buildInvitationLink,
  createInvitationToken,
  hashInvitationToken,
} from './invitation-token-service';
import type { ResolvedUser } from './types';

export class PatientInvitationError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
    this.name = 'PatientInvitationError';
  }
}

type PatientInvitationRecord = {
  id: string;
  organization_id: string;
  email: string;
  invitation_type: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

type PatientInvitationScope = {
  organizationId: string;
};

type PatientInvitationCreateOptions = {
  tokenFactory?: () => string;
  now?: () => Date;
};

type PatientInvitationAcceptRpcResult = {
  organization_id?: string;
  relationship_id?: string;
  relationship_reactivated?: boolean;
};

const invitationSelect = 'id,organization_id,email,invitation_type,status,expires_at,created_at,invited_by,accepted_at,revoked_at';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function toInvitationStatus(value: string): PatientInvitation['status'] {
  if (value === 'pending' || value === 'accepted' || value === 'revoked' || value === 'expired') return value;
  throw new PatientInvitationError('PATIENT_INVITATION_INVALID_STATUS', 500);
}

function normalizeInvitation(record: PatientInvitationRecord): PatientInvitation {
  if (record.invitation_type !== 'patient_relationship') {
    throw new PatientInvitationError('PATIENT_INVITATION_NOT_FOUND', 404);
  }
  return patientInvitationSchema.parse({
    id: record.id,
    email: record.email,
    status: toInvitationStatus(record.status),
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    acceptedAt: record.accepted_at,
    revokedAt: record.revoked_at,
  });
}

function ensureUsableInvitation(record: PatientInvitationRecord | null): PatientInvitationRecord {
  if (!record || record.invitation_type !== 'patient_relationship') {
    throw new PatientInvitationError('PATIENT_INVITATION_NOT_FOUND', 404);
  }
  if (record.status === 'revoked') throw new PatientInvitationError('PATIENT_INVITATION_REVOKED', 422);
  if (record.status === 'accepted') throw new PatientInvitationError('PATIENT_INVITATION_ALREADY_ACCEPTED', 409);
  if (record.status === 'expired' || new Date(record.expires_at).getTime() <= Date.now()) {
    throw new PatientInvitationError('PATIENT_INVITATION_EXPIRED', 422);
  }
  if (record.status !== 'pending') throw new PatientInvitationError('PATIENT_INVITATION_NOT_FOUND', 404);
  return record;
}

function mapRpcError(error: { message?: string } | null | undefined): PatientInvitationError {
  const message = error?.message ?? '';
  const known: Array<[string, string, number]> = [
    ['PATIENT_INVITATION_NOT_FOUND', 'PATIENT_INVITATION_NOT_FOUND', 404],
    ['PATIENT_INVITATION_EXPIRED', 'PATIENT_INVITATION_EXPIRED', 422],
    ['PATIENT_INVITATION_REVOKED', 'PATIENT_INVITATION_REVOKED', 422],
    ['PATIENT_INVITATION_ALREADY_ACCEPTED', 'PATIENT_INVITATION_ALREADY_ACCEPTED', 409],
    ['PATIENT_INVITATION_ALREADY_PENDING', 'PATIENT_INVITATION_ALREADY_PENDING', 409],
    ['PATIENT_INVITATION_EMAIL_MISMATCH', 'PATIENT_INVITATION_EMAIL_MISMATCH', 403],
    ['PATIENT_RELATIONSHIP_ALREADY_ACTIVE', 'PATIENT_RELATIONSHIP_ALREADY_ACTIVE', 409],
    ['PATIENT_INVITATION_ORGANIZATION_NOT_ACTIVE', 'FORBIDDEN', 403],
    ['PATIENT_INVITATION_INVALID_INPUT', 'VALIDATION_FAILED', 422],
  ];
  const match = known.find(([source]) => message.includes(source));
  return match
    ? new PatientInvitationError(match[1], match[2])
    : new PatientInvitationError('PATIENT_INVITATION_OPERATION_FAILED', 500);
}

async function authorizeOrganizationContext(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
): Promise<PatientInvitationScope> {
  const authorization = await getAuthorizationContext(db, user, { requestedOperationalContext: context });
  const active = authorization.activeOperationalContext;
  if (!active || active.kind !== 'organization' || active.organizationId !== context.id) {
    throw new PatientInvitationError('OPERATIONAL_CONTEXT_FORBIDDEN', 403);
  }
  if (!authorization.operationalPermissions.includes('patients.invite')) {
    throw new PatientInvitationError('FORBIDDEN', 403);
  }
  return { organizationId: active.organizationId };
}

async function getOrganizationName(db: SupabaseLike, organizationId: string): Promise<string> {
  const { data, error } = await db
    .from('organizations')
    .select('display_name,status')
    .eq('id', organizationId)
    .maybeSingle();
  const organization = data as unknown as { display_name?: string; status?: string } | null;
  if (error || organization?.status !== 'active') {
    throw new PatientInvitationError('FORBIDDEN', 403);
  }
  return organization.display_name?.trim() || 'la struttura';
}

async function getInvitationById(
  db: SupabaseLike,
  organizationId: string,
  invitationId: string,
): Promise<PatientInvitation> {
  const { data, error } = await db
    .from('invitations')
    .select(invitationSelect)
    .eq('id', invitationId)
    .eq('organization_id', organizationId)
    .eq('invitation_type', 'patient_relationship')
    .maybeSingle();
  if (error) throw new PatientInvitationError('PATIENT_INVITATION_LOOKUP_FAILED', 500);
  if (!data) throw new PatientInvitationError('PATIENT_INVITATION_NOT_FOUND', 404);
  return normalizeInvitation(data as unknown as PatientInvitationRecord);
}

async function expirePendingInvitations(db: SupabaseLike, organizationId: string, now: Date): Promise<void> {
  const { error } = await db
    .from('invitations')
    .update({ status: 'expired' })
    .eq('organization_id', organizationId)
    .eq('invitation_type', 'patient_relationship')
    .eq('status', 'pending')
    .lte('expires_at', now.toISOString());
  if (error) throw new PatientInvitationError('PATIENT_INVITATION_EXPIRY_FAILED', 500);
}

export async function createPatientInvitation(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  payload: CreatePatientInvitationRequest,
  options: PatientInvitationCreateOptions = {},
): Promise<{ invitation: PatientInvitation; acceptLink: string }> {
  const scope = await authorizeOrganizationContext(db, user, context);
  const now = options.now?.() ?? new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (payload.expiresInDays ?? 7));
  const rawToken = options.tokenFactory?.() ?? createInvitationToken();
  const { data, error } = await db.rpc('create_patient_relationship_invitation', {
    p_organization_id: scope.organizationId,
    p_email: normalizeEmail(payload.email),
    p_invited_by: user.id,
    p_token_hash: hashInvitationToken(rawToken),
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw mapRpcError(error);
  if (typeof data !== 'string') throw new PatientInvitationError('PATIENT_INVITATION_CREATE_FAILED', 500);

  return {
    invitation: await getInvitationById(db, scope.organizationId, data),
    acceptLink: buildInvitationLink('/inviti/paziente/accetta', rawToken),
  };
}

export async function listPatientInvitations(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
): Promise<PatientInvitationListResponse> {
  const scope = await authorizeOrganizationContext(db, user, context);
  await expirePendingInvitations(db, scope.organizationId, new Date());
  const { data, error } = await db
    .from('invitations')
    .select(invitationSelect)
    .eq('organization_id', scope.organizationId)
    .eq('invitation_type', 'patient_relationship')
    .is('hidden_from_history_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new PatientInvitationError('PATIENT_INVITATION_LIST_FAILED', 500);
  const items = (data ?? []).map((record: unknown) => normalizeInvitation(record as PatientInvitationRecord));
  return patientInvitationListResponseSchema.parse({ items, total: items.length });
}

export async function lookupPatientInvitation(
  db: SupabaseLike,
  token: string,
): Promise<PatientInvitationLookupResponse> {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new PatientInvitationError('PATIENT_INVITATION_NOT_FOUND', 404);
  const { data, error } = await db
    .from('invitations')
    .select(`${invitationSelect},organizations(display_name,status)`)
    .eq('token_hash', hashInvitationToken(normalizedToken))
    .eq('invitation_type', 'patient_relationship')
    .maybeSingle();
  if (error) throw new PatientInvitationError('PATIENT_INVITATION_LOOKUP_FAILED', 500);
  const record = data as unknown as (PatientInvitationRecord & { organizations?: { display_name?: string; status?: string } | null }) | null;
  const usable = ensureUsableInvitation(record);
  if (record?.organizations?.status !== 'active') throw new PatientInvitationError('PATIENT_INVITATION_NOT_FOUND', 404);
  return {
    organizationName: record.organizations?.display_name?.trim() || 'la struttura',
    expiresAt: usable.expires_at,
    status: 'pending',
  };
}

export async function acceptPatientInvitation(
  db: SupabaseLike,
  token: string,
  user: ResolvedUser,
): Promise<PatientInvitationAcceptResponse> {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new PatientInvitationError('PATIENT_INVITATION_NOT_FOUND', 404);
  const { data, error } = await db.rpc('accept_patient_relationship_invitation', {
    p_token_hash: hashInvitationToken(normalizedToken),
    p_user_id: user.id,
  });
  if (error) throw mapRpcError(error);
  const result = data as unknown as PatientInvitationAcceptRpcResult | null;
  if (!result?.organization_id || !result.relationship_id || typeof result.relationship_reactivated !== 'boolean') {
    throw new PatientInvitationError('PATIENT_INVITATION_ACCEPT_FAILED', 500);
  }
  return patientInvitationAcceptResponseSchema.parse({
    organizationName: await getOrganizationName(db, result.organization_id),
    relationshipId: result.relationship_id,
    relationshipReactivated: result.relationship_reactivated,
  });
}

export async function revokePatientInvitation(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  invitationId: string,
): Promise<{ id: string; status: 'revoked' }> {
  const scope = await authorizeOrganizationContext(db, user, context);
  const { data, error } = await db.rpc('revoke_patient_relationship_invitation', {
    p_organization_id: scope.organizationId,
    p_invitation_id: invitationId,
    p_actor_user_id: user.id,
  });
  if (error) throw mapRpcError(error);
  if (typeof data !== 'string') throw new PatientInvitationError('PATIENT_INVITATION_REVOKE_FAILED', 500);
  return { id: data, status: 'revoked' };
}
