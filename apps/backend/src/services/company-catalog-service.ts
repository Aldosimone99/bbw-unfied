import type { SupabaseLike } from '../db/supabase';
import { CatalogError } from './platform-catalog-service';

function mapOverrides(payload: any) {
  return {
    price_override_cents: payload.priceOverrideCents ?? null,
    duration_override_min: payload.durationOverrideMin ?? null,
    points_override: payload.pointsOverride ?? null,
    consent_template_id: payload.consentTemplateId ?? null,
  };
}

export async function listCompanyCatalog(db: SupabaseLike, companyId: string) {
  const { data, error } = await db
    .from('company_treatment_catalog')
    .select('*, platform_treatments(*)')
    .eq('company_id', companyId)
    .eq('is_active', true);
  if (error) throw new CatalogError('COMPANY_CATALOG_LIST_FAILED', 500);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    company_id: row.company_id,
    platform_treatment_id: row.platform_treatment_id,
    name: row.platform_treatments?.name ?? '',
    category: row.platform_treatments?.category ?? '',
    effective_price_cents: row.price_override_cents ?? row.platform_treatments?.price_cents ?? 0,
    effective_duration_min: row.duration_override_min ?? row.platform_treatments?.duration ?? 30,
    effective_points: row.points_override ?? row.platform_treatments?.points ?? 0,
    consent_template_id: row.consent_template_id ?? null,
    is_active: row.is_active,
  }));
}

export async function adoptTreatment(db: SupabaseLike, companyId: string, payload: any) {
  const { data, error } = await db
    .from('company_treatment_catalog')
    .insert({ company_id: companyId, platform_treatment_id: payload.platformTreatmentId, ...mapOverrides(payload) })
    .select('*')
    .single();
  if (error || !data) throw new CatalogError('COMPANY_CATALOG_ADOPT_FAILED', 500);
  return data;
}

export async function updateCompanyCatalogItem(db: SupabaseLike, companyId: string, id: string, payload: any) {
  const { data, error } = await db
    .from('company_treatment_catalog')
    .update(mapOverrides(payload))
    .eq('company_id', companyId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw new CatalogError('COMPANY_CATALOG_UPDATE_FAILED', 500);
  return data;
}

export async function deactivateCompanyCatalogItem(db: SupabaseLike, companyId: string, id: string) {
  const { error } = await db
    .from('company_treatment_catalog')
    .update({ is_active: false })
    .eq('company_id', companyId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new CatalogError('COMPANY_CATALOG_DEACTIVATE_FAILED', 500);
}
