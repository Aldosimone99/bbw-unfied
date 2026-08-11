import type { SupabaseLike } from '../db/supabase';
import { isTreatmentAllowedForUser } from './catalog-roles-service';
import { CatalogError, getPlatformTreatment } from './platform-catalog-service';

export async function listAssignments(db: SupabaseLike, professionalId: string) {
  const { data, error } = await db
    .from('professional_catalog_effective')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('is_active', true);
  if (error) throw new CatalogError('ASSIGNMENT_LIST_FAILED', 500);
  return data ?? [];
}

export async function createAssignment(db: SupabaseLike, professionalId: string, user: any, payload: any) {
  if (Boolean(payload.platformTreatmentId) === Boolean(payload.companyCatalogId))
    throw new CatalogError('EXACTLY_ONE_SOURCE_REQUIRED', 422);
  if (payload.companyCatalogId && payload.consentTemplateId)
    throw new CatalogError('CONSENT_CONTROLLED_BY_CLINIC', 422);
  if (payload.platformTreatmentId) {
    const treatment = await getPlatformTreatment(db, user, payload.platformTreatmentId);
    if (!isTreatmentAllowedForUser(treatment.allowed_roles as string[] | null, user))
      throw new CatalogError('TREATMENT_NOT_ALLOWED_FOR_ROLE', 403);
  }
  const { data, error } = await db
    .from('professional_catalog_assignments')
    .insert({
      professional_id: professionalId,
      platform_treatment_id: payload.platformTreatmentId ?? null,
      company_catalog_id: payload.companyCatalogId ?? null,
      price_override_cents: payload.priceOverrideCents ?? null,
      duration_override_min: payload.durationOverrideMin ?? null,
      points_override: payload.pointsOverride ?? null,
      consent_template_id: payload.consentTemplateId ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw new CatalogError('ASSIGNMENT_CREATE_FAILED', 500);
  return data;
}

export async function updateAssignment(db: SupabaseLike, professionalId: string, id: string, payload: any) {
  const { data, error } = await db
    .from('professional_catalog_assignments')
    .update({
      price_override_cents: payload.priceOverrideCents,
      duration_override_min: payload.durationOverrideMin,
      points_override: payload.pointsOverride,
      consent_template_id: payload.consentTemplateId,
      is_public: payload.isPublic,
    })
    .eq('professional_id', professionalId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw new CatalogError('ASSIGNMENT_UPDATE_FAILED', 500);
  return data;
}

export async function deactivateAssignment(db: SupabaseLike, professionalId: string, id: string) {
  const { error } = await db
    .from('professional_catalog_assignments')
    .update({ is_active: false })
    .eq('professional_id', professionalId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new CatalogError('ASSIGNMENT_DEACTIVATE_FAILED', 500);
}

export async function acceptDisclaimer(db: SupabaseLike, professionalId: string, id: string) {
  const { error } = await db
    .from('professional_catalog_assignments')
    .update({ disclaimer_accepted: true, disclaimer_accepted_at: new Date().toISOString() })
    .eq('professional_id', professionalId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new CatalogError('ASSIGNMENT_DISCLAIMER_FAILED', 500);
}
