import type { NextFunction, Request, Response } from 'express';
import { authCache, type AuthCache } from '../services/auth-cache-service';
import type { SupabaseLike } from '../db/supabase';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

let _adminClient: SupabaseLike | null = null;
function getAdminClient(): SupabaseLike {
  if (!_adminClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    _adminClient = createClient(url, key, { auth: { persistSession: false }, realtime: { transport: ws as any } });
  }
  return _adminClient;
}

export function resolveUser(supabase: SupabaseLike, cache: AuthCache = authCache) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) return res.status(401).json({ error: 'MISSING_TOKEN' });

    const cached = cache.get(token);
    if (cached) {
      req.user = cached;
      return next();
    }

    const { data: authData, error } = await getAdminClient().auth.getUser(token);
    const authUser = authData?.user;
    if (error || !authUser) return res.status(401).json({ error: 'INVALID_TOKEN' });

    const [{ data: profile, error: profileError }, { data: accountRoles, error: roleError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .eq('user_id', authUser.id)
        .single(),
      supabase
        .from('account_roles')
        .select('roles(code)')
        .eq('user_id', authUser.id),
    ]);

    if (profileError || roleError || !profile) return res.status(401).json({ error: 'USER_NOT_FOUND' });

    const isPlatformAdmin = (accountRoles ?? []).some((row: any) => row.roles?.code === 'platform_admin');
    const appUser = {
      id: authUser.id,
      email: authUser.email ?? '',
      // Compatibility field for legacy route adapters. It is never read from
      // the database as an authorization source; organization roles come from
      // verified membership and permissions.
      tipo_utente: isPlatformAdmin ? 'admin' : 'privato',
      nome: profile.first_name ?? null,
      cognome: profile.last_name ?? null,
    } as const;

    cache.set(token, appUser);
    req.user = appUser;
    return next();
  };
}
