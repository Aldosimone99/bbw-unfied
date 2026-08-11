import type { PlatformTreatment } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { isTreatmentAllowedForUser } from './catalog-roles-service';

export class CatalogError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
  }
}

type CatalogUser = { tipo_utente?: string | null; specializzazioni?: string[] | null };

export async function listPlatformTreatments(
  db: SupabaseLike,
  user: CatalogUser | null,
  filters: { category?: string },
): Promise<PlatformTreatment[]> {
  const query = db.from('platform_treatments').select('*').eq('is_active', true);
  if (filters.category) query.eq('category', filters.category);
  const { data, error } = await query.order('name', { ascending: true });
  if (error) throw new CatalogError('PLATFORM_CATALOG_LIST_FAILED', 500);
  return ((data ?? []) as PlatformTreatment[]).filter((row) => isTreatmentAllowedForUser(row.allowed_roles as string[] | null, user));
}

export async function getPlatformTreatment(db: SupabaseLike, user: CatalogUser | null, id: string): Promise<PlatformTreatment> {
  const { data, error } = await db.from('platform_treatments').select('*').eq('id', id).maybeSingle();
  if (error || !data) throw new CatalogError('TREATMENT_NOT_FOUND', 404);
  const treatment = data as PlatformTreatment;
  if (!treatment.is_active || !isTreatmentAllowedForUser(treatment.allowed_roles as string[] | null, user)) {
    throw new CatalogError('TREATMENT_NOT_ALLOWED_FOR_ROLE', 403);
  }
  return treatment;
}
