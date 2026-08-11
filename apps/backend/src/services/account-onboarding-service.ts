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
): Promise<void> {
  if ((await readOnboardingState(db, userId)) === 'completed') {
    throw new AccountOnboardingError('ONBOARDING_ALREADY_COMPLETED');
  }

  // This is an intent/request, never an authorization role assignment.
  const { error } = await db.from('users').update({
    requested_account_type: payload.account_type,
    requested_organization_name: payload.organization_display_name ?? null,
    onboarding_status: 'completed',
    onboarding_completed_at: new Date().toISOString(),
  }).eq('id', userId);

  if (error) throw new AccountOnboardingError('ONBOARDING_UPDATE_FAILED');
}
