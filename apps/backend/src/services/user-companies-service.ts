import type { SupabaseLike } from '../db/supabase';

export async function listUserCompanies(db: SupabaseLike, userId: string) {
  const { data, error } = await db
    .from('organization_members')
    .select('id,status,organization_id,organizations(id, display_name)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) throw new Error('LIST_USER_COMPANIES_FAILED');

  return (data ?? []).map((row: any) => ({
    id: (row.organizations as any).id as string,
    name: (row.organizations as any).display_name as string,
    role: 'member',
  }));
}
