import type {
  ProfessionalProfileCreateRequest,
  ProfessionalProfileUpdateRequest,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';

export class ProfessionalProfileError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
  }
}

async function getProfessionalType(db: SupabaseLike, code: string) {
  const { data, error } = await db
    .from('professional_types')
    .select('id,code,category,display_name,verification_required')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new ProfessionalProfileError('PROFESSIONAL_TYPE_LOOKUP_FAILED', 500);
  if (!data) throw new ProfessionalProfileError('PROFESSIONAL_TYPE_NOT_FOUND', 404);
  return data;
}

function normalizeProfile(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    professionalType: row.professional_types ? {
      code: row.professional_types.code,
      category: row.professional_types.category,
      displayName: row.professional_types.display_name,
      verificationRequired: row.professional_types.verification_required,
    } : null,
    displayName: row.display_name ?? null,
    bio: row.bio ?? null,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProfessionalTypes(db: SupabaseLike) {
  const { data, error } = await db
    .from('professional_types')
    .select('id,code,category,display_name,verification_required')
    .eq('is_active', true)
    .order('category')
    .order('display_name');
  if (error) throw new ProfessionalProfileError('PROFESSIONAL_TYPE_LIST_FAILED', 500);
  return data ?? [];
}

export async function listOwnProfessionalProfiles(db: SupabaseLike, userId: string) {
  const { data, error } = await db
    .from('professional_profiles')
    .select('id,user_id,display_name,bio,verification_status,verified_at,created_at,updated_at,professional_types(id,code,category,display_name,verification_required)')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw new ProfessionalProfileError('PROFESSIONAL_PROFILE_LIST_FAILED', 500);
  return (data ?? []).map(normalizeProfile);
}

export async function createOwnProfessionalProfile(
  db: SupabaseLike,
  userId: string,
  payload: ProfessionalProfileCreateRequest,
) {
  const professionalType = await getProfessionalType(db, payload.professional_type_code);
  const { data, error } = await db
    .from('professional_profiles')
    .insert({
      user_id: userId,
      professional_type_id: professionalType.id,
      display_name: payload.display_name ?? null,
      bio: payload.bio ?? null,
      verification_status: 'draft',
    })
    .select('id,user_id,display_name,bio,verification_status,verified_at,created_at,updated_at,professional_types(id,code,category,display_name,verification_required)')
    .single();
  if (error || !data) {
    if (/duplicate|unique/i.test(error?.message ?? '')) {
      throw new ProfessionalProfileError('PROFESSIONAL_PROFILE_ALREADY_EXISTS', 409);
    }
    throw new ProfessionalProfileError('PROFESSIONAL_PROFILE_CREATE_FAILED', 500);
  }
  return normalizeProfile(data);
}

export async function updateOwnProfessionalProfile(
  db: SupabaseLike,
  userId: string,
  profileId: string,
  payload: ProfessionalProfileUpdateRequest,
) {
  const updates: Record<string, unknown> = {};
  if (payload.display_name !== undefined) updates.display_name = payload.display_name;
  if (payload.bio !== undefined) updates.bio = payload.bio;
  if (Object.keys(updates).length === 0) throw new ProfessionalProfileError('PROFESSIONAL_PROFILE_NO_CHANGES', 422);

  const { data, error } = await db
    .from('professional_profiles')
    .update(updates)
    .eq('id', profileId)
    .eq('user_id', userId)
    .select('id,user_id,display_name,bio,verification_status,verified_at,created_at,updated_at,professional_types(id,code,category,display_name,verification_required)')
    .single();
  if (error || !data) throw new ProfessionalProfileError('PROFESSIONAL_PROFILE_NOT_FOUND', 404);
  return normalizeProfile(data);
}

export async function requestProfessionalVerification(db: SupabaseLike, userId: string, profileId: string) {
  const { data, error } = await db
    .from('professional_profiles')
    .update({ verification_status: 'pending' })
    .eq('id', profileId)
    .eq('user_id', userId)
    .in('verification_status', ['draft', 'rejected'])
    .select('id,user_id,display_name,bio,verification_status,verified_at,created_at,updated_at,professional_types(id,code,category,display_name,verification_required)')
    .single();
  if (error || !data) throw new ProfessionalProfileError('PROFESSIONAL_PROFILE_NOT_READY', 422);

  const { error: auditError } = await db.from('audit_events').insert({
    actor_user_id: userId,
    organization_id: null,
    action: 'professional_profile.verification_requested',
    resource_type: 'professional_profile',
    resource_id: data.id,
    metadata: {},
  });
  if (auditError) throw new ProfessionalProfileError('PROFESSIONAL_PROFILE_AUDIT_FAILED', 500);

  return normalizeProfile(data);
}
