import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

export type SupabaseLike = ReturnType<typeof createClient> | any;

export function createSupabaseServerClient(): SupabaseLike {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws as any },
  });
}

export function createSupabaseAuthClient(): SupabaseLike {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws as any },
  });
}
