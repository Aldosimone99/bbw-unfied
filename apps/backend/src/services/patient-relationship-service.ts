import type {
  CreatePatientRelationshipRequest,
  PatientLookupRequest,
  PatientLookupResponse,
  PatientRelationship,
  PatientRelationshipList,
  OperationalContextReference,
} from '@bbw/interfaces';
import { patientRelationshipListSchema } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { getAuthorizationContext } from './authorization-context-service';
import type { ResolvedUser } from './types';

export class PatientRelationshipError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
    this.name = 'PatientRelationshipError';
  }
}

type RelationshipRpcRow = {
  relationship_id: string;
  subject_id: string;
  organization_id: string | null;
  professional_profile_id: string | null;
  origin_kind: 'organization' | 'professional';
  origin_organization_id: string | null;
  origin_professional_profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  birth_date: string | null;
  status: string;
  linked_at: string;
  removed_at: string | null;
};

type LookupRpcRow = {
  subject_id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

type PatientScope =
  | { kind: 'organization'; id: string; organizationId: string }
  | { kind: 'personal_professional'; id: string; professionalProfileId: string };

function requestedScope(context: OperationalContextReference): PatientScope {
  return context.kind === 'organization'
    ? { kind: context.kind, id: context.id, organizationId: context.id }
    : { kind: context.kind, id: context.id, professionalProfileId: context.id };
}

function mapRpcError(error: { message?: string } | null | undefined): PatientRelationshipError {
  const message = error?.message ?? '';
  const known: Array<[string, string, number]> = [
    ['PATIENT_RELATIONSHIP_ALREADY_ACTIVE', 'PATIENT_RELATIONSHIP_ALREADY_ACTIVE', 409],
    ['PATIENT_RELATIONSHIP_NOT_FOUND', 'PATIENT_RELATIONSHIP_NOT_FOUND', 404],
    ['PATIENT_SUBJECT_NOT_FOUND', 'PATIENT_SUBJECT_NOT_FOUND', 404],
    ['PATIENT_SUBJECT_DELETED', 'PATIENT_SUBJECT_DELETED', 410],
    ['PATIENT_ORGANIZATION_NOT_FOUND', 'PATIENT_ORGANIZATION_NOT_FOUND', 404],
    ['PATIENT_PROFESSIONAL_PROFILE_NOT_FOUND', 'PATIENT_PROFESSIONAL_PROFILE_NOT_FOUND', 404],
  ];
  const match = known.find(([source]) => message.includes(source));
  return match ? new PatientRelationshipError(match[1], match[2]) : new PatientRelationshipError('PATIENT_OPERATION_FAILED', 500);
}

async function authorizeScope(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  permission: 'patients.read' | 'patients.link' | 'patients.unlink',
): Promise<PatientScope> {
  const authorization = await getAuthorizationContext(db, user, { requestedOperationalContext: context });
  const active = authorization.activeOperationalContext;
  if (!active || active.kind !== context.kind
    || (active.kind === 'organization' ? active.organizationId : active.professionalProfileId) !== context.id) {
    throw new PatientRelationshipError('OPERATIONAL_CONTEXT_FORBIDDEN', 403);
  }
  if (!authorization.operationalPermissions.includes(permission)) {
    throw new PatientRelationshipError('FORBIDDEN', 403);
  }
  return requestedScope(context);
}

function normalizeRelationship(row: RelationshipRpcRow, scope: PatientScope): PatientRelationship {
  return {
    relationshipId: row.relationship_id,
    subjectId: row.subject_id,
    relationshipScope: scope.kind,
    organizationId: row.organization_id,
    professionalProfileId: row.professional_profile_id,
    originKind: row.origin_kind,
    originOrganizationId: row.origin_organization_id,
    originProfessionalProfileId: row.origin_professional_profile_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    birthDate: row.birth_date,
    status: row.status === 'active' || row.status === 'removed' ? row.status : 'removed',
    linkedAt: row.linked_at,
    removedAt: row.removed_at,
  };
}

export async function listPatientRelationships(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
): Promise<PatientRelationshipList> {
  const scope = await authorizeScope(db, user, context, 'patients.read');
  const rpcName = scope.kind === 'organization'
    ? 'list_organization_patient_relationships'
    : 'list_professional_patient_relationships';
  const rpcArgs = scope.kind === 'organization'
    ? { p_organization_id: scope.organizationId }
    : { p_professional_profile_id: scope.professionalProfileId };
  const { data, error } = await db.rpc(rpcName, rpcArgs);
  if (error) throw mapRpcError(error);
  const items = ((data ?? []) as unknown as RelationshipRpcRow[]).map((row) => normalizeRelationship(row, scope));
  return patientRelationshipListSchema.parse({ relationshipScope: scope.kind, items, total: items.length });
}

export async function lookupPatient(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  payload: PatientLookupRequest,
): Promise<PatientLookupResponse> {
  await authorizeScope(db, user, context, 'patients.link');
  const { data, error } = await db.rpc('lookup_patient_accounts', {
    p_email: payload.email ?? null,
    p_tax_code: payload.taxCode ?? null,
  });
  if (error) throw mapRpcError(error);
  const matches = (data ?? []) as unknown as LookupRpcRow[];
  if (matches.length === 0) throw new PatientRelationshipError('PATIENT_NOT_FOUND', 404);
  if (matches.length > 1) throw new PatientRelationshipError('PATIENT_LOOKUP_AMBIGUOUS', 409);
  const match = matches[0];
  return {
    subjectId: match.subject_id,
    userId: match.user_id,
    email: match.email,
    firstName: match.first_name,
    lastName: match.last_name,
  };
}

export async function createPatientRelationship(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  payload: CreatePatientRelationshipRequest,
): Promise<PatientRelationship> {
  const scope = await authorizeScope(db, user, context, 'patients.link');
  const rpcName = scope.kind === 'organization' ? 'link_organization_patient' : 'link_professional_patient';
  const rpcArgs = scope.kind === 'organization'
    ? { p_actor_user_id: user.id, p_organization_id: scope.organizationId, p_subject_id: payload.subjectId }
    : { p_actor_user_id: user.id, p_professional_profile_id: scope.professionalProfileId, p_subject_id: payload.subjectId };
  const { data: relationshipId, error } = await db.rpc(rpcName, rpcArgs);
  if (error) throw mapRpcError(error);
  if (typeof relationshipId !== 'string') throw new PatientRelationshipError('PATIENT_OPERATION_FAILED', 500);
  const list = await listPatientRelationships(db, user, context);
  const relationship = list.items.find((item) => item.relationshipId === relationshipId);
  if (!relationship) throw new PatientRelationshipError('PATIENT_OPERATION_FAILED', 500);
  return relationship;
}

export async function getPatientRelationship(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  relationshipId: string,
): Promise<PatientRelationship> {
  const list = await listPatientRelationships(db, user, context);
  const relationship = list.items.find((item) => item.relationshipId === relationshipId);
  if (!relationship) throw new PatientRelationshipError('PATIENT_RELATIONSHIP_NOT_FOUND', 404);
  return relationship;
}

export async function removePatientRelationship(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  relationshipId: string,
): Promise<{ relationshipId: string; status: 'removed' }> {
  const scope = await authorizeScope(db, user, context, 'patients.unlink');
  const rpcName = scope.kind === 'organization'
    ? 'remove_organization_patient_relationship'
    : 'remove_professional_patient_relationship';
  const rpcArgs = scope.kind === 'organization'
    ? { p_actor_user_id: user.id, p_organization_id: scope.organizationId, p_relationship_id: relationshipId }
    : { p_actor_user_id: user.id, p_professional_profile_id: scope.professionalProfileId, p_relationship_id: relationshipId };
  const { data, error } = await db.rpc(rpcName, rpcArgs);
  if (error) throw mapRpcError(error);
  if (typeof data !== 'string') throw new PatientRelationshipError('PATIENT_OPERATION_FAILED', 500);
  return { relationshipId: data, status: 'removed' };
}
