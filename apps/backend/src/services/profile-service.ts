import type { ProfileUpdateRequest } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import type { ResolvedUser } from './types';

const supportedProfileKeys = new Set(['nome', 'cognome', 'telefono']);

export class ProfileAccessError extends Error {
  status = 403;
  code = 'FORBIDDEN_PROFILE_FIELDS';
}

export async function getCurrentUserProfile(db: SupabaseLike, userId: string) {
  const [{ data, error }, { data: authData }] = await Promise.all([
    db.from('profiles')
      .select('user_id,first_name,last_name,phone,onboarding_intent,onboarding_status,created_at,updated_at')
      .eq('user_id', userId)
      .single(),
    db.auth.admin.getUserById(userId),
  ]);

  if (error || !data) throw error ?? new Error('PROFILE_NOT_FOUND');

  return {
    id: data.user_id,
    user_id: data.user_id,
    email: authData?.user?.email ?? null,
    nome: data.first_name,
    cognome: data.last_name,
    telefono: data.phone,
    onboarding_intent: data.onboarding_intent,
    onboarding_status: data.onboarding_status,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateCurrentUserProfile(db: SupabaseLike, user: ResolvedUser, payload: ProfileUpdateRequest) {
  const unsupported = Object.keys(payload).filter((key) => !supportedProfileKeys.has(key));
  if (unsupported.length > 0 || 'tipo_utente' in payload) {
    throw new ProfileAccessError('PROFILE_FIELDS_REQUIRE_DOMAIN_WORKFLOW');
  }

  const fields: Record<string, unknown> = {};
  if (payload.nome !== undefined) fields.first_name = payload.nome;
  if (payload.cognome !== undefined) fields.last_name = payload.cognome;
  if (payload.telefono !== undefined) fields.phone = payload.telefono;

  if (Object.keys(fields).length > 0) {
    const { error } = await db.from('profiles').update(fields).eq('user_id', user.id);
    if (error) throw error;
  }

  return getCurrentUserProfile(db, user.id);
}
