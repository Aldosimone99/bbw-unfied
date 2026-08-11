import type { SupabaseLike } from '../db/supabase';

export async function listUserCompanies(db: SupabaseLike, userId: string) {
  const { data, error } = await db
    .from('company_members')
    .select('role, companies(id, name)')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw new Error('LIST_USER_COMPANIES_FAILED');

  return (data ?? []).map((row: any) => ({
    id: (row.companies as any).id as string,
    name: (row.companies as any).name as string,
    role: row.role as string,
  }));
}
