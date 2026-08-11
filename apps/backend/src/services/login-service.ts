import type { Request } from 'express';
import type { LoginPayload } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { createSupabaseServerClient } from '../db/supabase';
import { rateLimit, RateLimitError } from './rate-limit-service';
import type { ResolvedUser } from './types';

export { RateLimitError };

interface LoginSuccess {
  success: true;
  user: ResolvedUser;
  token: string;
  refreshToken: string;
}

interface LoginFailure {
  success: false;
  status: number;
  code: string;
}

export type LoginOutcome = LoginSuccess | LoginFailure;

function sanitizeUser(raw: Record<string, unknown>): ResolvedUser {
  return {
    id: raw['id'] as string,
    email: raw['email'] as string,
    tipo_utente: raw['tipo_utente'] as ResolvedUser['tipo_utente'],
    nome: (raw['nome'] as string | null | undefined) ?? null,
    cognome: (raw['cognome'] as string | null | undefined) ?? null,
  };
}

/** Stub: always returns false. Replace with real suppression check when available. */
export async function isEmailSuppressed(_email: string): Promise<boolean> {
  return false;
}

export async function login(
  db: SupabaseLike,
  payload: LoginPayload,
  req: Pick<Request, 'ip'>,
  _isEmailSuppressed: (email: string) => Promise<boolean> = isEmailSuppressed,
): Promise<LoginOutcome> {
  // 1. Rate limit by email/CF + IP
  const identifier = payload.email ?? payload.codiceFiscale ?? 'unknown';
  await rateLimit({ key: identifier, limit: 10, window: 10 * 60 * 1000 });
  await rateLimit({ key: req.ip ?? 'unknown-ip', limit: 50, window: 10 * 60 * 1000 });

  // 2. Find user by email or codice fiscale in public.users
  let query = db.from('users').select('id, email, tipo_utente, nome, cognome');

  if (payload.email) {
    query = query.eq('email', payload.email);
  } else {
    query = query.eq('codice_fiscale', payload.codiceFiscale!);
  }

  const { data: user, error: userError } = await query.maybeSingle();

  // No enumeration: always return INVALID_CREDENTIALS when user not found
  if (userError || !user) {
    return { success: false, status: 401, code: 'INVALID_CREDENTIALS' };
  }

  // 3. Validate userType if provided (admin bypasses)
  if (payload.userType && user['tipo_utente'] !== 'admin') {
    if (user['tipo_utente'] !== payload.userType) {
      return { success: false, status: 401, code: 'ROLE_MISMATCH' };
    }
  }

  // 4. Check email suppression
  const suppressed = await _isEmailSuppressed(user['email'] as string);
  if (suppressed) {
    return { success: false, status: 422, code: 'EMAIL_SUPPRESSED' };
  }

  // 5. Supabase auth.signInWithPassword — uses an isolated client so the shared
  //    service-role db client is never contaminated with a user session.
  const { data: authData, error: authError } = await createSupabaseServerClient().auth.signInWithPassword({
    email: user['email'] as string,
    password: payload.password,
  });

  if (authError || !authData?.session) {
    return { success: false, status: 401, code: 'INVALID_CREDENTIALS' };
  }

  // 6. Return sanitized user + tokens
  return {
    success: true,
    user: sanitizeUser(user as Record<string, unknown>),
    token: authData.session.access_token,
    refreshToken: authData.session.refresh_token,
  };
}
