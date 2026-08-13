import type {
  CatalogCategory,
  CatalogFilters,
  CatalogTreatment,
  CreateTreatmentOfferingRequest,
  OperationalContextReference,
  TreatmentOffering,
  UpdateTreatmentOfferingRequest,
} from '@bbw/interfaces';
import {
  catalogCategoryListResponseSchema,
  catalogTreatmentListResponseSchema,
  treatmentOfferingListResponseSchema,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { getAuthorizationContext } from './authorization-context-service';
import type { ResolvedUser } from './types';

export class CatalogServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
    this.name = 'CatalogServiceError';
  }
}

type CatalogScope =
  | { kind: 'organization'; id: string; organizationId: string }
  | { kind: 'personal_professional'; id: string; professionalProfileId: string };

type CategoryRelation = { id: string; code: string; display_name: string } | Array<{ id: string; code: string; display_name: string }> | null;
type CategoryListRow = {
  id: string;
  code: string;
  display_name: string;
  is_active: boolean;
  sort_order: number;
};
type TreatmentRow = {
  id: string;
  external_code: string;
  name: string;
  category_id: string;
  description: string | null;
  body_area: string | null;
  default_points: number;
  default_price_cents: number;
  default_duration_min_minutes: number;
  default_duration_max_minutes: number;
  duration_label: string;
  professional_requirements: string[];
  is_active: boolean;
  treatment_categories: CategoryRelation;
};
type OfferingRpcRow = {
  offering_id: string;
  organization_id: string | null;
  professional_profile_id: string | null;
  catalog_treatment_id: string;
  external_code: string;
  name: string;
  category_code: string;
  category_display_name: string;
  body_area: string | null;
  default_price_cents: number;
  default_duration_min_minutes: number;
  default_duration_max_minutes: number;
  default_points: number;
  price_cents: number;
  duration_minutes: number;
  points: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ScopePermission =
  | 'catalog.read'
  | 'catalog.offering.read'
  | 'catalog.offering.create'
  | 'catalog.offering.update'
  | 'catalog.offering.remove';

function relationOne(value: CategoryRelation): { id: string; code: string; display_name: string } | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function scopeFromContext(context: OperationalContextReference): CatalogScope {
  return context.kind === 'organization'
    ? { kind: context.kind, id: context.id, organizationId: context.id }
    : { kind: context.kind, id: context.id, professionalProfileId: context.id };
}

function mapRpcError(error: { message?: string } | null | undefined): CatalogServiceError {
  const message = error?.message ?? '';
  const known: Array<[string, string, number]> = [
    ['CATALOG_TREATMENT_NOT_FOUND', 'CATALOG_TREATMENT_NOT_FOUND', 404],
    ['CATALOG_OFFERING_NOT_FOUND', 'CATALOG_OFFERING_NOT_FOUND', 404],
    ['CATALOG_ORGANIZATION_NOT_FOUND', 'CATALOG_ORGANIZATION_NOT_FOUND', 404],
    ['CATALOG_PROFESSIONAL_PROFILE_NOT_FOUND', 'CATALOG_PROFESSIONAL_PROFILE_NOT_FOUND', 404],
    ['CATALOG_OFFERING_INVALID_INPUT', 'CATALOG_OFFERING_INVALID_INPUT', 422],
    ['CATALOG_OFFERING_FIELD_FORBIDDEN', 'CATALOG_OFFERING_FIELD_FORBIDDEN', 422],
  ];
  const match = known.find(([source]) => message.includes(source));
  return match ? new CatalogServiceError(match[1], match[2]) : new CatalogServiceError('CATALOG_OPERATION_FAILED', 500);
}

async function authorizeContext(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  permission: ScopePermission,
): Promise<CatalogScope> {
  const authorization = await getAuthorizationContext(db, user, { requestedOperationalContext: context });
  const active = authorization.activeOperationalContext;
  const activeId = active?.kind === 'organization' ? active.organizationId : active?.kind === 'personal_professional' ? active.professionalProfileId : null;
  if (!active || active.kind !== context.kind || activeId !== context.id) {
    throw new CatalogServiceError('OPERATIONAL_CONTEXT_FORBIDDEN', 403);
  }
  if (!authorization.operationalPermissions.includes(permission)) {
    throw new CatalogServiceError('FORBIDDEN', 403);
  }
  return scopeFromContext(context);
}

function normalizeTreatment(row: TreatmentRow): CatalogTreatment {
  const category = relationOne(row.treatment_categories);
  if (!category) throw new CatalogServiceError('CATALOG_CATEGORY_NOT_FOUND', 500);
  return {
    id: row.id,
    externalCode: row.external_code,
    name: row.name,
    categoryId: row.category_id,
    categoryCode: category.code,
    categoryDisplayName: category.display_name,
    description: row.description,
    bodyArea: row.body_area,
    defaultPoints: row.default_points,
    defaultPriceCents: row.default_price_cents,
    defaultDurationMinMinutes: row.default_duration_min_minutes,
    defaultDurationMaxMinutes: row.default_duration_max_minutes,
    durationLabel: row.duration_label,
    professionalRequirements: row.professional_requirements.filter((value): value is CatalogTreatment['professionalRequirements'][number] => (
      value === 'physician' || value === 'healthcare_professional' || value === 'beauty_professional'
    )),
    isActive: row.is_active,
  };
}

function normalizeOffering(row: OfferingRpcRow, scope: CatalogScope): TreatmentOffering {
  return {
    id: row.offering_id,
    scope: scope.kind,
    organizationId: row.organization_id,
    professionalProfileId: row.professional_profile_id,
    catalogTreatmentId: row.catalog_treatment_id,
    externalCode: row.external_code,
    name: row.name,
    categoryCode: row.category_code,
    categoryDisplayName: row.category_display_name,
    bodyArea: row.body_area,
    defaultPriceCents: row.default_price_cents,
    defaultDurationMinMinutes: row.default_duration_min_minutes,
    defaultDurationMaxMinutes: row.default_duration_max_minutes,
    defaultPoints: row.default_points,
    priceCents: row.price_cents,
    durationMinutes: row.duration_minutes,
    points: row.points,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const treatmentSelect = 'id,external_code,name,category_id,description,body_area,default_points,default_price_cents,default_duration_min_minutes,default_duration_max_minutes,duration_label,professional_requirements,is_active,treatment_categories(id,code,display_name)';

export async function listCatalogCategories(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
): Promise<CatalogCategory[]> {
  await authorizeContext(db, user, context, 'catalog.read');
  const { data, error } = await db.from('treatment_categories').select('id,code,display_name,is_active,sort_order').eq('is_active', true).order('sort_order', { ascending: true });
  if (error) throw new CatalogServiceError('CATALOG_CATEGORY_LIST_FAILED', 500);
  const categories = ((data ?? []) as CategoryListRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }));
  return catalogCategoryListResponseSchema.parse({ items: categories, total: categories.length }).items;
}

export async function listCatalogTreatments(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  filters: CatalogFilters,
): Promise<CatalogTreatment[]> {
  await authorizeContext(db, user, context, 'catalog.read');
  const { data, error } = await db.from('catalog_treatments').select(treatmentSelect).eq('is_active', true).order('name', { ascending: true });
  if (error) throw new CatalogServiceError('CATALOG_TREATMENT_LIST_FAILED', 500);
  const search = filters.search?.toLocaleLowerCase('it');
  const categoryCode = filters.categoryCode?.toLocaleLowerCase('it');
  const bodyArea = filters.bodyArea?.toLocaleLowerCase('it');
  const items = (data as unknown as TreatmentRow[] ?? [])
    .map(normalizeTreatment)
    .filter((treatment) => !search || `${treatment.name} ${treatment.categoryDisplayName} ${treatment.bodyArea ?? ''}`.toLocaleLowerCase('it').includes(search))
    .filter((treatment) => !categoryCode || treatment.categoryCode.toLocaleLowerCase('it') === categoryCode)
    .filter((treatment) => !bodyArea || treatment.bodyArea?.toLocaleLowerCase('it').includes(bodyArea));
  return catalogTreatmentListResponseSchema.parse({ items, total: items.length }).items;
}

async function fetchOfferings(db: SupabaseLike, scope: CatalogScope): Promise<TreatmentOffering[]> {
  const rpcName = scope.kind === 'organization' ? 'list_organization_treatment_offerings' : 'list_professional_treatment_offerings';
  const args = scope.kind === 'organization'
    ? { p_organization_id: scope.organizationId }
    : { p_professional_profile_id: scope.professionalProfileId };
  const { data, error } = await db.rpc(rpcName, args);
  if (error) throw mapRpcError(error);
  const items = ((data ?? []) as unknown as OfferingRpcRow[]).map((row) => normalizeOffering(row, scope));
  return treatmentOfferingListResponseSchema.parse({ items, total: items.length }).items;
}

export async function listTreatmentOfferings(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
): Promise<TreatmentOffering[]> {
  const scope = await authorizeContext(db, user, context, 'catalog.offering.read');
  return fetchOfferings(db, scope);
}

async function getMasterTreatment(db: SupabaseLike, catalogTreatmentId: string): Promise<CatalogTreatment> {
  const { data, error } = await db.from('catalog_treatments').select(treatmentSelect).eq('id', catalogTreatmentId).eq('is_active', true).maybeSingle();
  if (error || !data) throw new CatalogServiceError('CATALOG_TREATMENT_NOT_FOUND', 404);
  return normalizeTreatment(data as unknown as TreatmentRow);
}

async function getCreatedOffering(db: SupabaseLike, scope: CatalogScope, offeringId: string): Promise<TreatmentOffering> {
  const item = (await fetchOfferings(db, scope)).find((offering) => offering.id === offeringId);
  if (!item) throw new CatalogServiceError('CATALOG_OFFERING_OPERATION_FAILED', 500);
  return item;
}

export async function createTreatmentOffering(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  payload: CreateTreatmentOfferingRequest,
): Promise<TreatmentOffering> {
  const scope = await authorizeContext(db, user, context, 'catalog.offering.create');
  const treatment = await getMasterTreatment(db, payload.catalogTreatmentId);
  const args = {
    p_actor_user_id: user.id,
    p_catalog_treatment_id: payload.catalogTreatmentId,
    p_price_cents: payload.priceCents ?? treatment.defaultPriceCents,
    p_duration_minutes: payload.durationMinutes ?? treatment.defaultDurationMinMinutes,
    p_points: payload.points ?? treatment.defaultPoints,
  };
  const rpcName = scope.kind === 'organization' ? 'create_organization_treatment_offering' : 'create_professional_treatment_offering';
  const rpcArgs = scope.kind === 'organization' ? { ...args, p_organization_id: scope.organizationId } : { ...args, p_professional_profile_id: scope.professionalProfileId };
  const { data, error } = await db.rpc(rpcName, rpcArgs);
  if (error) throw mapRpcError(error);
  if (typeof data !== 'string') throw new CatalogServiceError('CATALOG_OFFERING_OPERATION_FAILED', 500);
  return getCreatedOffering(db, scope, data);
}

export async function updateTreatmentOffering(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  offeringId: string,
  payload: UpdateTreatmentOfferingRequest,
): Promise<TreatmentOffering> {
  const scope = await authorizeContext(db, user, context, 'catalog.offering.update');
  const updates = Object.fromEntries(Object.entries(payload).map(([key, value]) => [
    key === 'priceCents' ? 'price_cents' : key === 'durationMinutes' ? 'duration_minutes' : key === 'isActive' ? 'is_active' : key,
    value,
  ]));
  const rpcName = scope.kind === 'organization' ? 'update_organization_treatment_offering' : 'update_professional_treatment_offering';
  const rpcArgs = scope.kind === 'organization'
    ? { p_actor_user_id: user.id, p_organization_id: scope.organizationId, p_offering_id: offeringId, p_updates: updates }
    : { p_actor_user_id: user.id, p_professional_profile_id: scope.professionalProfileId, p_offering_id: offeringId, p_updates: updates };
  const { data, error } = await db.rpc(rpcName, rpcArgs);
  if (error) throw mapRpcError(error);
  if (typeof data !== 'string') throw new CatalogServiceError('CATALOG_OFFERING_OPERATION_FAILED', 500);
  return getCreatedOffering(db, scope, data);
}

export async function removeTreatmentOffering(
  db: SupabaseLike,
  user: ResolvedUser,
  context: OperationalContextReference,
  offeringId: string,
): Promise<{ id: string; isActive: false }> {
  const scope = await authorizeContext(db, user, context, 'catalog.offering.remove');
  const rpcName = scope.kind === 'organization' ? 'remove_organization_treatment_offering' : 'remove_professional_treatment_offering';
  const rpcArgs = scope.kind === 'organization'
    ? { p_actor_user_id: user.id, p_organization_id: scope.organizationId, p_offering_id: offeringId }
    : { p_actor_user_id: user.id, p_professional_profile_id: scope.professionalProfileId, p_offering_id: offeringId };
  const { data, error } = await db.rpc(rpcName, rpcArgs);
  if (error) throw mapRpcError(error);
  if (typeof data !== 'string') throw new CatalogServiceError('CATALOG_OFFERING_OPERATION_FAILED', 500);
  return { id: data, isActive: false };
}
