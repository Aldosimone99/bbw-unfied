import type { Request } from 'express';
import type { LoginPayload } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { createSupabaseAuthClient } from '../db/supabase';
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

function sanitizeUser(raw: Record<string, unknown>, isPlatformAdmin = false): ResolvedUser {
  return {
    id: raw['id'] as string,
    email: raw['email'] as string,
    // Compatibility field only. Authorization is resolved from account roles,
    // memberships and permissions, never from this label.
    tipo_utente: isPlatformAdmin ? 'admin' : 'privato',
    nome: (raw['first_name'] as string | null | undefined) ?? null,
    cognome: (raw['last_name'] as string | null | undefined) ?? null,
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
  authClient: SupabaseLike = createSupabaseAuthClient(),
  rateLimitFn: typeof rateLimit = rateLimit,
): Promise<LoginOutcome> {
  // 1. Rate limit by email/CF + IP
  const identifier = payload.email ?? payload.codiceFiscale ?? 'unknown';
  await rateLimitFn({ key: identifier, limit: 10, window: 10 * 60 * 1000 });
  await rateLimitFn({ key: req.ip ?? 'unknown-ip', limit: 50, window: 10 * 60 * 1000 });

  // 2. Login is account-first: email is the only initial identifier. The old
  // codice fiscale and userType fields are intentionally not authorization
  // inputs anymore.
  if (!payload.email) return { success: false, status: 401, code: 'INVALID_CREDENTIALS' };

  const suppressed = await _isEmailSuppressed(payload.email);
  if (suppressed) {
    return { success: false, status: 422, code: 'EMAIL_SUPPRESSED' };
  }

  // 3. Supabase auth.signInWithPassword — uses an isolated client so the shared
  //    service-role db client is never contaminated with a user session.
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (authError || !authData?.session) {
    return { success: false, status: 401, code: 'INVALID_CREDENTIALS' };
  }

  const authUserId = authData.user?.id;
  if (!authUserId) return { success: false, status: 401, code: 'INVALID_CREDENTIALS' };

  const [{ data: profile, error: profileError }, { data: accountRoles, error: roleError }] = await Promise.all([
    db.from('profiles').select('user_id,first_name,last_name').eq('user_id', authUserId).maybeSingle(),
    db.from('account_roles').select('roles(code)').eq('user_id', authUserId),
  ]);

  if (profileError || roleError || !profile) return { success: false, status: 401, code: 'USER_NOT_FOUND' };

  const isPlatformAdmin = (accountRoles ?? []).some((row: any) => row.roles?.code === 'platform_admin');

  // 4. Return sanitized user + tokens.
  return {
    success: true,
    user: sanitizeUser({
      id: authUserId,
      email: authData.user.email ?? payload.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
    }, isPlatformAdmin),
    token: authData.session.access_token,
    refreshToken: authData.session.refresh_token,
  };
}
