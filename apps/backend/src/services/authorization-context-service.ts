import {
  addressInputSchema,
  professionalVerificationStatusSchema,
  type AddressInput,
} from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import {
  getOperationalReadiness,
  type ProfessionalReadinessInput,
} from './operational-readiness-service';
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

type OrganizationRow = {
  id: string;
  display_name: string;
  legal_name: string | null;
  tax_identifier: string | null;
  email: string | null;
  phone: string | null;
  registered_address: unknown;
  status: string;
  organization_type_id: string;
};

type MembershipRow = {
  id: string;
  organization_id: string;
  status: string;
  joined_at: string | null;
  organizations: OrganizationRow | null;
};

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birth_date: string | null;
  tax_code: string | null;
  residential_address: unknown;
  onboarding_intent: string | null;
  onboarding_status: string;
};

type OrganizationTypeRow = { id: string; code: string; display_name: string };
type RoleRow = { id: string; code: string; display_name: string; scope: string; is_active: boolean };
type PermissionRow = { id: string; code: string };
type RolePermissionRow = { role_id: string; permission_id: string };
type MemberRoleRow = { organization_member_id: string; role_id: string };
type OrganizationMemberRow = { id: string };
type ProfessionalProfileRow = {
  verification_status: unknown;
  professional_types: { code: string; verification_required: boolean } | null;
};

type AuthorizationContextOptions = {
  requestedOrganizationId?: string;
};

function unique(values: BackendPermissionCode[]): BackendPermissionCode[] {
  return [...new Set(values)];
}

function asPermissionCode(value: string): BackendPermissionCode | null {
  return (permissionCodes as readonly string[]).includes(value) ? value as BackendPermissionCode : null;
}

function asAddress(value: unknown): AddressInput | null {
  const parsed = addressInputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toProfessionalReadinessInputs(rows: ProfessionalProfileRow[]): ProfessionalReadinessInput[] {
  return rows.flatMap((row) => {
    const verificationStatus = professionalVerificationStatusSchema.safeParse(row.verification_status);
    if (!row.professional_types || !verificationStatus.success) return [];

    return [{
      professionalTypeCode: row.professional_types.code,
      verificationRequired: row.professional_types.verification_required,
      verificationStatus: verificationStatus.data,
    }];
  });
}

export async function getAuthorizationContext(
  db: SupabaseLike,
  user: ResolvedUser,
  options: AuthorizationContextOptions = {},
) {
  const [
    { data: profileData, error: profileError },
    { data: membershipData, error: membershipError },
    { data: rolesData, error: rolesError },
    { data: permissionsData, error: permissionsError },
    { data: rolePermissionsData, error: rolePermissionsError },
    { data: accountRolesData, error: accountRolesError },
    { data: organizationTypesData, error: organizationTypesError },
    { data: professionalProfileData, error: professionalProfileError },
  ] = await Promise.all([
    db.from('profiles')
      .select('user_id,first_name,last_name,phone,birth_date,tax_code,residential_address,onboarding_intent,onboarding_status')
      .eq('user_id', user.id)
      .single(),
    db.from('organization_members')
      .select('id,organization_id,status,joined_at,organizations(id,display_name,legal_name,tax_identifier,email,phone,registered_address,status,organization_type_id)')
      .eq('user_id', user.id),
    db.from('roles').select('id,code,display_name,scope,is_active').eq('is_active', true),
    db.from('permissions').select('id,code'),
    db.from('role_permissions').select('role_id,permission_id'),
    db.from('account_roles').select('role_id').eq('user_id', user.id),
    db.from('organization_types').select('id,code,display_name').eq('is_active', true),
    db.from('professional_profiles')
      .select('verification_status,professional_types(code,verification_required)')
      .eq('user_id', user.id),
  ]);

  if (
    profileError
    || membershipError
    || rolesError
    || permissionsError
    || rolePermissionsError
    || accountRolesError
    || organizationTypesError
    || professionalProfileError
    || !profileData
  ) {
    throw new Error('AUTHORIZATION_CONTEXT_FAILED');
  }

  const profileRow = profileData as ProfileRow;
  const membershipRows = (membershipData ?? []) as MembershipRow[];
  const roles = (rolesData ?? []) as RoleRow[];
  const permissions = (permissionsData ?? []) as PermissionRow[];
  const rolePermissions = (rolePermissionsData ?? []) as RolePermissionRow[];
  const accountRoles = (accountRolesData ?? []) as Array<{ role_id: string }>;
  const organizationTypes = (organizationTypesData ?? []) as OrganizationTypeRow[];
  const professionalProfiles = toProfessionalReadinessInputs((professionalProfileData ?? []) as ProfessionalProfileRow[]);

  const roleById = new Map(roles.map((role) => [role.id, role]));
  const organizationTypeById = new Map(organizationTypes.map((type) => [type.id, type]));
  const permissionById = new Map(permissions.map((permission) => [permission.id, permission.code]));
  const permissionIdsByRole = new Map<string, string[]>();

  for (const mapping of rolePermissions) {
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

  const memberRoleRows = membershipRows.length > 0
    ? await db.from('member_roles')
      .select('organization_member_id,role_id')
      .in('organization_member_id', membershipRows.map((membership) => membership.id))
    : { data: [], error: null };

  if (memberRoleRows.error) throw new Error('AUTHORIZATION_CONTEXT_FAILED');

  const memberRolesByMembership = new Map<string, string[]>();
  for (const assignment of (memberRoleRows.data ?? []) as MemberRoleRow[]) {
    const current = memberRolesByMembership.get(assignment.organization_member_id) ?? [];
    current.push(assignment.role_id);
    memberRolesByMembership.set(assignment.organization_member_id, current);
  }

  const activeMemberships = membershipRows
    .filter((membership) => membership.status === 'active' && membership.organizations?.status === 'active')
    .map((membership) => {
      const roleIds = memberRolesByMembership.get(membership.id) ?? [];
      const membershipRoles = roleIds
        .map((roleId) => roleById.get(roleId))
        .filter((role): role is RoleRow => Boolean(role && role.scope === 'organization'));

      return {
        summary: {
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
        },
        organization: membership.organizations,
      };
    });

  const selectedMembership = options.requestedOrganizationId
    ? activeMemberships.find((membership) => membership.summary.organizationId === options.requestedOrganizationId) ?? activeMemberships[0] ?? null
    : activeMemberships[0] ?? null;

  let hasActiveManager = false;
  if (selectedMembership) {
    const { data: organizationMembersData, error: organizationMembersError } = await db
      .from('organization_members')
      .select('id')
      .eq('organization_id', selectedMembership.summary.organizationId)
      .eq('status', 'active');

    if (organizationMembersError) throw new Error('AUTHORIZATION_CONTEXT_FAILED');

    const organizationMembers = (organizationMembersData ?? []) as OrganizationMemberRow[];
    if (organizationMembers.length > 0) {
      const { data: managerRoleData, error: managerRoleError } = await db
        .from('member_roles')
        .select('organization_member_id,role_id')
        .in('organization_member_id', organizationMembers.map((member) => member.id));

      if (managerRoleError) throw new Error('AUTHORIZATION_CONTEXT_FAILED');

      hasActiveManager = ((managerRoleData ?? []) as MemberRoleRow[]).some((assignment) => (
        permissionsForRoles([assignment.role_id]).includes('organization.update')
      ));
    }
  }

  const globalRoleIds = accountRoles.map((role) => role.role_id);
  const globalPermissions: BackendPermissionCode[] = [
    'profile.read_own',
    'profile.update_own',
  ];
  if (profileRow.onboarding_status === 'completed') globalPermissions.push('dashboard.access');
  globalPermissions.push(...permissionsForRoles(globalRoleIds));

  const activeOrganization = selectedMembership?.summary ?? null;
  const organizationPermissions = unique(activeOrganization?.permissions ?? []);
  const readiness = getOperationalReadiness({
    personalProfile: {
      firstName: profileRow.first_name ?? null,
      lastName: profileRow.last_name ?? null,
      birthDate: profileRow.birth_date ?? null,
      taxCode: profileRow.tax_code ?? null,
      address: asAddress(profileRow.residential_address),
    },
    organization: selectedMembership?.organization ? {
      legalName: selectedMembership.organization.legal_name ?? null,
      displayName: selectedMembership.organization.display_name ?? null,
      organizationTypeId: selectedMembership.organization.organization_type_id ?? null,
      taxIdentifier: selectedMembership.organization.tax_identifier ?? null,
      email: selectedMembership.organization.email ?? null,
      phone: selectedMembership.organization.phone ?? null,
      address: asAddress(selectedMembership.organization.registered_address),
      hasActiveManager,
    } : null,
    professionalProfiles,
    professionalIntent: ['professional', 'healthcare_professional', 'beauty_professional'].includes(profileRow.onboarding_intent ?? ''),
  });

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
      birthDate: profileRow.birth_date ?? null,
      taxCode: profileRow.tax_code ?? null,
      address: asAddress(profileRow.residential_address),
      requestedAccountType: profileRow.onboarding_intent ?? null,
      operationalRole: null,
      accountTypeStatus: 'not_required' as const,
      onboardingStatus: profileRow.onboarding_status,
    },
    memberships: activeMemberships.map((membership) => membership.summary),
    activeOrganization,
    globalPermissions: unique(globalPermissions),
    organizationPermissions,
    permissions: unique([...globalPermissions, ...organizationPermissions]),
    readiness,
  };
}
