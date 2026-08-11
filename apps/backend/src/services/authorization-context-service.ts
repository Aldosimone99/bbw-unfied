import type { SupabaseLike } from '../db/supabase';
import type { ResolvedUser } from './types';

export const permissionCodes = [
  'dashboard.access',
  'platform.admin.access',
  'profile.read_own',
  'profile.update_own',
  'organization.create',
  'organization.read',
  'organization.update',
  'organization.members.read',
  'organization.members.invite',
  'organization.members.manage',
] as const;

export type BackendPermissionCode = (typeof permissionCodes)[number];

type UserContextRow = ResolvedUser & {
  telefono?: string | null;
  requested_account_type?: string | null;
  onboarding_status?: string | null;
};

type MembershipRow = {
  id: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  companies: { id: string; name: string; clinic_display_name?: string | null } | null;
};

const organizationPermissionsByRole: Record<string, BackendPermissionCode[]> = {
  owner: ['organization.read', 'organization.update', 'organization.members.read', 'organization.members.invite', 'organization.members.manage'],
  admin: ['organization.read', 'organization.update', 'organization.members.read', 'organization.members.invite', 'organization.members.manage'],
  medical_director: ['organization.read', 'organization.members.read'],
  professional: ['organization.read'],
  staff: ['organization.read'],
};

function unique(values: BackendPermissionCode[]): BackendPermissionCode[] {
  return [...new Set(values)];
}

function profile(row: UserContextRow) {
  const requestedAccountType = row.requested_account_type ?? null;
  const onboardingStatus = row.onboarding_status ?? 'profile_required';
  const operationalRole = row.tipo_utente === 'privato' ? null : row.tipo_utente;

  return {
    id: row.id,
    userId: row.id,
    firstName: row.nome ?? null,
    lastName: row.cognome ?? null,
    phone: row.telefono ?? null,
    requestedAccountType,
    operationalRole,
    accountTypeStatus: 'not_required' as const,
    onboardingStatus,
  };
}

export async function getAuthorizationContext(db: SupabaseLike, user: ResolvedUser) {
  const [{ data: userRow, error: userError }, { data: membershipRows, error: membershipError }] = await Promise.all([
    db.from('users')
      .select('id,email,tipo_utente,nome,cognome,telefono,requested_account_type,onboarding_status')
      .eq('id', user.id)
      .single(),
    db.from('company_members')
      .select('id,role,is_active,created_at,companies(id,name,clinic_display_name)')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ]);

  if (userError || !userRow || membershipError) throw new Error('AUTHORIZATION_CONTEXT_FAILED');

  const memberships = ((membershipRows ?? []) as MembershipRow[])
    .filter((row) => row.is_active && row.companies)
    .map((row) => ({
      id: row.id,
      organizationId: row.companies!.id,
      organizationDisplayName: row.companies!.clinic_display_name ?? row.companies!.name,
      organizationTypeCode: null,
      organizationTypeDisplayName: null,
      organizationStatus: 'active',
      status: 'active',
      joinedAt: row.created_at,
      roles: [{ code: row.role, displayName: row.role }],
      permissions: organizationPermissionsByRole[row.role] ?? [],
    }));

  const nextProfile = profile(userRow as UserContextRow);
  const globalPermissions: BackendPermissionCode[] = [
    'profile.read_own',
    'profile.update_own',
  ];
  if (nextProfile.onboardingStatus === 'completed') globalPermissions.push('dashboard.access');
  if (userRow.tipo_utente === 'admin') globalPermissions.push('platform.admin.access');

  const activeOrganization = memberships[0] ?? null;
  const organizationPermissions = unique(activeOrganization?.permissions ?? []);

  return {
    user: {
      id: userRow.id,
      email: userRow.email,
      tipo_utente: userRow.tipo_utente,
      nome: userRow.nome ?? null,
      cognome: userRow.cognome ?? null,
    },
    profile: nextProfile,
    memberships,
    activeOrganization,
    globalPermissions: unique(globalPermissions),
    organizationPermissions,
    permissions: unique([...globalPermissions, ...organizationPermissions]),
  };
}
