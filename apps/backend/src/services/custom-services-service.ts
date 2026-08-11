import type { SupabaseLike } from '../db/supabase';
import { CatalogError } from './platform-catalog-service';

function mapCustomServicePayload(payload: any) {
  return {
    name: payload.name,
    description: payload.description ?? null,
    description_male: payload.descriptionMale ?? null,
    description_female: payload.descriptionFemale ?? null,
    category: payload.category ?? null,
    duration: payload.duration,
    price_cents: payload.priceCents,
    points: payload.points ?? 0,
    insurance_included: payload.insuranceIncluded ?? false,
    location: payload.location ?? null,
  };
}

export async function listCustomServices(db: SupabaseLike, professionalId: string) {
  const { data, error } = await db
    .from('custom_services')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('is_active', true);
  if (error) throw new CatalogError('CUSTOM_SERVICES_LIST_FAILED', 500);
  return data ?? [];
}

export async function createCustomService(db: SupabaseLike, user: any, payload: any, companyId?: string) {
  if (payload.duration % 30 !== 0) throw new CatalogError('DURATION_MUST_BE_30_MULTIPLE', 422);

  const serviceBody = { ...mapCustomServicePayload(payload), professional_id: user.id };
  const { data: service, error: serviceError } = await db
    .from('custom_services')
    .insert(serviceBody)
    .select('*')
    .single();
  if (serviceError || !service) throw new CatalogError('CUSTOM_SERVICE_CREATE_FAILED', 500);

  if (companyId) {
    const { error: cscError } = await db
      .from('company_service_catalog')
      .insert({ company_id: companyId, service_id: service.id, professional_id: user.id })
      .select('*')
      .single();
    if (cscError) throw new CatalogError('COMPANY_SERVICE_CATALOG_CREATE_FAILED', 500);
  } else {
    const { error: pciError } = await db
      .from('professional_catalog_items')
      .insert({ professional_id: user.id, custom_service_id: service.id })
      .select('*')
      .single();
    if (pciError) throw new CatalogError('PROFESSIONAL_CATALOG_ITEM_CREATE_FAILED', 500);
  }

  return service;
}

export async function updateCustomService(db: SupabaseLike, professionalId: string, id: string, payload: any) {
  if (payload.duration !== undefined && payload.duration % 30 !== 0)
    throw new CatalogError('DURATION_MUST_BE_30_MULTIPLE', 422);

  const { data, error } = await db
    .from('custom_services')
    .update(mapCustomServicePayload(payload))
    .eq('id', id)
    .eq('professional_id', professionalId)
    .select('*')
    .single();
  if (error || !data) throw new CatalogError('CUSTOM_SERVICE_UPDATE_FAILED', 500);
  return data;
}

export async function deleteCustomService(db: SupabaseLike, professionalId: string, id: string) {
  const { error } = await db
    .from('custom_services')
    .update({ is_active: false })
    .eq('id', id)
    .eq('professional_id', professionalId);
  if (error) throw new CatalogError('CUSTOM_SERVICE_DELETE_FAILED', 500);
}
