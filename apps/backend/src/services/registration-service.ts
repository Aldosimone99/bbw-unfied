import type { RegisterRequest } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { devStore } from './otp-service';

interface RegistrationErrorShape {
  code: string;
  status: number;
  message?: string;
}

export class RegistrationError extends Error {
  constructor(public readonly details: RegistrationErrorShape) {
    super(details.message ?? details.code);
  }
}

async function assertRegistrationOtpVerified(email: string, reference?: string): Promise<void> {
  if (!reference) return;

  if (process.env.NODE_ENV !== 'production') {
    const record = devStore.get(reference) as { email: string; verifiedAt: number | null; expiresAt: number } | undefined;
    if (!record || record.email !== email || !record.verifiedAt || Date.now() > record.expiresAt) {
      throw new RegistrationError({ code: 'REGISTRATION_OTP_REQUIRED', status: 422 });
    }
    return;
  }

  throw new RegistrationError({ code: 'REGISTRATION_EMAIL_VERIFICATION_REQUIRED', status: 422 });
}

async function insertOrThrow(query: PromiseLike<{ error?: { message?: string } | null }>): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(error.message ?? 'DATABASE_WRITE_FAILED');
}

function acceptedAt(accepted: boolean): string | null {
  return accepted ? new Date().toISOString() : null;
}

/**
 * Creates only the neutral account foundation. Professional, organization and
 * operational context are intentionally collected after login in onboarding.
 */
export async function registerUser(
  db: SupabaseLike,
  payload: RegisterRequest,
  metadata: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ userId: string }> {
  await assertRegistrationOtpVerified(payload.email, payload.otp_reference);

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: process.env.NODE_ENV !== 'production',
  });

  const userId = authData?.user?.id;
  if (authError || !userId) {
    const duplicate = /already|exists|registered/i.test(authError?.message ?? '');
    throw new RegistrationError({
      code: duplicate ? 'EMAIL_ALREADY_EXISTS' : 'AUTH_USER_CREATE_FAILED',
      status: duplicate ? 409 : 502,
      message: authError?.message,
    });
  }

  try {
    await insertOrThrow(db.from('profiles').update({
      first_name: payload.nome ?? null,
      last_name: payload.cognome ?? null,
      phone: payload.telefono ?? null,
    }).eq('user_id', userId));

    await insertOrThrow(db.from('subjects').insert({
      subject_kind: 'person',
      user_id: userId,
    }));

    const now = new Date().toISOString();
    await insertOrThrow(db.from('account_consents').insert([
      {
        user_id: userId,
        consent_type: 'terms',
        accepted: payload.accept_terms,
        version: '1.0',
        ip_address: metadata.ipAddress ?? null,
        user_agent: metadata.userAgent ?? null,
        accepted_at: acceptedAt(payload.accept_terms),
      },
      {
        user_id: userId,
        consent_type: 'privacy',
        accepted: payload.accept_privacy,
        version: '1.0',
        ip_address: metadata.ipAddress ?? null,
        user_agent: metadata.userAgent ?? null,
        accepted_at: acceptedAt(payload.accept_privacy),
      },
      {
        user_id: userId,
        consent_type: 'marketing',
        accepted: payload.consenso_marketing,
        version: '1.0',
        ip_address: metadata.ipAddress ?? null,
        user_agent: metadata.userAgent ?? null,
        accepted_at: acceptedAt(payload.consenso_marketing),
      },
      {
        user_id: userId,
        consent_type: 'profiling',
        accepted: payload.consenso_profilazione,
        version: '1.0',
        ip_address: metadata.ipAddress ?? null,
        user_agent: metadata.userAgent ?? null,
        accepted_at: acceptedAt(payload.consenso_profilazione),
      },
    ]));

    await insertOrThrow(db.from('audit_events').insert({
      actor_user_id: userId,
      action: 'account.registered',
      resource_type: 'account',
      resource_id: userId,
      metadata: { local_bootstrap_email_confirmed: process.env.NODE_ENV !== 'production' },
      created_at: now,
    }));

    return { userId };
  } catch (error) {
    await db.from('subjects').delete().eq('user_id', userId);
    await db.from('account_consents').delete().eq('user_id', userId);
    await db.from('audit_events').delete().eq('actor_user_id', userId);
    await db.auth.admin.deleteUser(userId);
    throw new RegistrationError({
      code: 'REGISTRATION_FAILED',
      status: 500,
      message: error instanceof Error ? error.message : undefined,
    });
  }
}
