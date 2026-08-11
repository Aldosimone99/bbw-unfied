import type { OnboardingCompletionRequest, OnboardingProfileRequest } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';

export class AccountOnboardingError extends Error {
  constructor(public readonly code: 'ONBOARDING_NOT_FOUND' | 'ONBOARDING_ALREADY_COMPLETED' | 'ONBOARDING_UPDATE_FAILED') {
    super(code);
  }
}

async function readOnboardingState(db: SupabaseLike, userId: string): Promise<string> {
  const { data, error } = await db.from('users').select('id,onboarding_status').eq('id', userId).single();
  if (error || !data) throw new AccountOnboardingError('ONBOARDING_NOT_FOUND');
  return (data as { onboarding_status?: string }).onboarding_status ?? 'profile_required';
}

export async function saveAccountProfile(
  db: SupabaseLike,
  userId: string,
  payload: OnboardingProfileRequest,
): Promise<void> {
  if ((await readOnboardingState(db, userId)) === 'completed') {
    throw new AccountOnboardingError('ONBOARDING_ALREADY_COMPLETED');
  }

  const { error } = await db.from('users').update({
    nome: payload.nome,
    cognome: payload.cognome,
    telefono: payload.telefono ?? null,
    onboarding_status: 'account_type_required',
  }).eq('id', userId);

  if (error) throw new AccountOnboardingError('ONBOARDING_UPDATE_FAILED');
}

export async function completeAccountOnboarding(
  db: SupabaseLike,
  userId: string,
  payload: OnboardingCompletionRequest,
): Promise<{ companyId: string | null }> {
  try {
    const { data, error } = await db.rpc('complete_account_onboarding', {
      p_user_id: userId,
      p_account_type: payload.account_type,
      p_organization_display_name: payload.organization_display_name ?? null,
    });

    if (error) {
      if (error.message?.includes('ONBOARDING_NOT_FOUND')) throw new AccountOnboardingError('ONBOARDING_NOT_FOUND');
      if (error.message?.includes('ONBOARDING_ALREADY_COMPLETED')) throw new AccountOnboardingError('ONBOARDING_ALREADY_COMPLETED');
      throw new AccountOnboardingError('ONBOARDING_UPDATE_FAILED');
    }

    return { companyId: typeof data?.company_id === 'string' ? data.company_id : null };
  } catch (error) {
    if (error instanceof AccountOnboardingError) throw error;
    throw new AccountOnboardingError('ONBOARDING_UPDATE_FAILED');
  }
}
