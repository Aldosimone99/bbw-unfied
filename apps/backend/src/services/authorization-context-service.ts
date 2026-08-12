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
  'professional_profile.create',
  'professional_profile.read_own',
  'professional_profile.update_own',
  'professional_profile.verify',
  'audit.read',
] as const;

export type BackendPermissionCode = (typeof permissionCodes)[number];

type MembershipRow = {
  id: string;
  organization_id: string;
  status: string;
  joined_at: string | null;
  organizations: {
    id: string;
    display_name: string;
    status: string;
    organization_type_id: string;
  } | null;
};

type OrganizationTypeRow = { id: string; code: string; display_name: string };

type RoleRow = { id: string; code: string; display_name: string; scope: string; is_active: boolean };
type PermissionRow = { id: string; code: string };
type RolePermissionRow = { role_id: string; permission_id: string };
type MemberRoleRow = { organization_member_id: string; role_id: string };

function unique(values: BackendPermissionCode[]): BackendPermissionCode[] {
  return [...new Set(values)];
}

function asPermissionCode(value: string): BackendPermissionCode | null {
  return (permissionCodes as readonly string[]).includes(value) ? value as BackendPermissionCode : null;
}

export async function getAuthorizationContext(db: SupabaseLike, user: ResolvedUser) {
  const [{ data: profileRow, error: profileError }, { data: membershipRows, error: membershipError }, { data: roles, error: rolesError }, { data: permissions, error: permissionsError }, { data: rolePermissions, error: rolePermissionsError }, { data: accountRoles, error: accountRolesError }, { data: organizationTypes, error: organizationTypesError }] = await Promise.all([
    db.from('profiles')
      .select('user_id,first_name,last_name,phone,onboarding_intent,onboarding_status')
      .eq('user_id', user.id)
      .single(),
    db.from('organization_members')
      .select('id,organization_id,status,joined_at,organizations(id,display_name,status,organization_type_id)')
      .eq('user_id', user.id),
    db.from('roles').select('id,code,display_name,scope,is_active').eq('is_active', true),
    db.from('permissions').select('id,code'),
    db.from('role_permissions').select('role_id,permission_id'),
    db.from('account_roles').select('role_id').eq('user_id', user.id),
    db.from('organization_types').select('id,code,display_name').eq('is_active', true),
  ]);

  if (profileError || membershipError || rolesError || permissionsError || rolePermissionsError || accountRolesError || organizationTypesError || !profileRow) {
    throw new Error('AUTHORIZATION_CONTEXT_FAILED');
  }

  const roleById = new Map((roles as RoleRow[]).map((role) => [role.id, role]));
  const organizationTypeById = new Map((organizationTypes as OrganizationTypeRow[]).map((type) => [type.id, type]));
  const permissionById = new Map((permissions as PermissionRow[]).map((permission) => [permission.id, permission.code]));
  const permissionIdsByRole = new Map<string, string[]>();

  for (const mapping of rolePermissions as RolePermissionRow[]) {
    const current = permissionIdsByRole.get(mapping.role_id) ?? [];
    current.push(mapping.permission_id);
    permissionIdsByRole.set(mapping.role_id, current);
  }

  const permissionsForRoles = (roleIds: string[]) => unique(
    roleIds
      .flatMap((roleId) => permissionIdsByRole.get(roleId) ?? [])
      .map((permissionId) => permissionById.get(permissionId))
      .filter((code): code is string => Boolean(code))
      .map(asPermissionCode)
      .filter((code): code is BackendPermissionCode => code !== null),
  );

  const memberRoleRows = (membershipRows ?? []).length > 0
    ? await db.from('member_roles')
      .select('organization_member_id,role_id')
      .in('organization_member_id', (membershipRows as MembershipRow[]).map((membership) => membership.id))
    : { data: [], error: null };

  if (memberRoleRows.error) throw new Error('AUTHORIZATION_CONTEXT_FAILED');

  const memberRolesByMembership = new Map<string, string[]>();
  for (const assignment of (memberRoleRows.data ?? []) as MemberRoleRow[]) {
    const current = memberRolesByMembership.get(assignment.organization_member_id) ?? [];
    current.push(assignment.role_id);
    memberRolesByMembership.set(assignment.organization_member_id, current);
  }

  const activeMemberships = (membershipRows as MembershipRow[])
    .filter((membership) => membership.status === 'active' && membership.organizations?.status === 'active')
    .map((membership) => {
      const roleIds = memberRolesByMembership.get(membership.id) ?? [];
      const membershipRoles = roleIds
        .map((roleId) => roleById.get(roleId))
        .filter((role): role is RoleRow => Boolean(role && role.scope === 'organization'));

      return {
        id: membership.id,
        organizationId: membership.organization_id,
        organizationDisplayName: membership.organizations?.display_name ?? null,
        organizationTypeCode: membership.organizations ? organizationTypeById.get(membership.organizations.organization_type_id)?.code ?? null : null,
        organizationTypeDisplayName: membership.organizations ? organizationTypeById.get(membership.organizations.organization_type_id)?.display_name ?? null : null,
        organizationStatus: membership.organizations?.status ?? null,
        status: membership.status,
        joinedAt: membership.joined_at,
        roles: membershipRoles.map((role) => ({ code: role.code, displayName: role.display_name })),
        permissions: permissionsForRoles(membershipRoles.map((role) => role.id)),
      };
    });

  const globalRoleIds = (accountRoles ?? []).map((role: { role_id: string }) => role.role_id);
  const globalPermissions: BackendPermissionCode[] = [
    'profile.read_own',
    'profile.update_own',
  ];
  if (profileRow.onboarding_status === 'completed') globalPermissions.push('dashboard.access');
  globalPermissions.push(...permissionsForRoles(globalRoleIds));

  const activeOrganization = activeMemberships[0] ?? null;
  const organizationPermissions = unique(activeOrganization?.permissions ?? []);

  return {
    user: {
      id: user.id,
      email: user.email,
      tipo_utente: user.tipo_utente,
      nome: profileRow.first_name ?? null,
      cognome: profileRow.last_name ?? null,
    },
    profile: {
      id: user.id,
      userId: user.id,
      firstName: profileRow.first_name ?? null,
      lastName: profileRow.last_name ?? null,
      phone: profileRow.phone ?? null,
      requestedAccountType: profileRow.onboarding_intent ?? null,
      operationalRole: null,
      accountTypeStatus: 'not_required' as const,
      onboardingStatus: profileRow.onboarding_status,
    },
    memberships: activeMemberships,
    activeOrganization,
    globalPermissions: unique(globalPermissions),
    organizationPermissions,
    permissions: unique([...globalPermissions, ...organizationPermissions]),
  };
}
