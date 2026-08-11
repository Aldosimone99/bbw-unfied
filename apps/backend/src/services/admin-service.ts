import type { SupabaseLike } from '../db/supabase';
import type { UserResponse } from '@bbw/interfaces';
import type { AppRole } from '@bbw/interfaces';

export async function listAllUsers(db: SupabaseLike): Promise<UserResponse[]> {
  const { data, error } = await db
    .from('users')
    .select('id, email, tipo_utente, nome, cognome, telefono, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as UserResponse[];
}

export async function listUsersByRole(db: SupabaseLike, role: AppRole): Promise<UserResponse[]> {
  const { data, error } = await db
    .from('users')
    .select('id, email, tipo_utente, nome, cognome, telefono, created_at')
    .eq('tipo_utente', role)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as UserResponse[];
}
