import type { PersonalProfileUpdateRequest } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import type { ResolvedUser } from './types';

export class ProfileAccessError extends Error {
  constructor(
    public readonly code: 'PROFILE_NOT_FOUND' | 'PROFILE_UPDATE_FAILED',
    public readonly status = 404 | 500,
  ) {
    super(code);
    this.name = 'ProfileAccessError';
  }
}

type CanonicalProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birth_date: string | null;
  tax_code: string | null;
  residential_address: unknown;
  onboarding_intent: string | null;
  onboarding_status: string;
  created_at: string;
  updated_at: string;
};

const profileColumns = 'user_id,first_name,last_name,phone,birth_date,tax_code,residential_address,onboarding_intent,onboarding_status,created_at,updated_at';

function definedUpdates(payload: PersonalProfileUpdateRequest): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export async function getCurrentUserProfile(db: SupabaseLike, userId: string) {
  const [{ data, error }, { data: authData }] = await Promise.all([
    db.from('profiles')
      .select(profileColumns)
      .eq('user_id', userId)
      .single(),
    db.auth.admin.getUserById(userId),
  ]);

  if (error || !data) throw new ProfileAccessError('PROFILE_NOT_FOUND', 404);
  const profile = data as CanonicalProfileRow;

  return {
    id: profile.user_id,
    user_id: profile.user_id,
    email: authData?.user?.email ?? null,
    first_name: profile.first_name,
    last_name: profile.last_name,
    phone: profile.phone,
    birth_date: profile.birth_date,
    tax_code: profile.tax_code,
    address: profile.residential_address,
    onboarding_intent: profile.onboarding_intent,
    onboarding_status: profile.onboarding_status,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

export async function updateCurrentUserProfile(
  db: SupabaseLike,
  user: ResolvedUser,
  payload: PersonalProfileUpdateRequest,
) {
  const updates = definedUpdates(payload);
  if (Object.keys(updates).length === 0) return getCurrentUserProfile(db, user.id);

  const { error } = await db.rpc('update_personal_profile_with_audit', {
    p_user_id: user.id,
    p_updates: updates,
  });
  if (error) {
    const status = error.message?.includes('PROFILE_NOT_FOUND') ? 404 : 500;
    throw new ProfileAccessError(status === 404 ? 'PROFILE_NOT_FOUND' : 'PROFILE_UPDATE_FAILED', status);
  }

  return getCurrentUserProfile(db, user.id);
}
