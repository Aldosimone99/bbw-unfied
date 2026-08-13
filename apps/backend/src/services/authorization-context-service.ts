import {
  addressInputSchema,
  professionalVerificationStatusSchema,
  type AddressInput,
  type OperationalContext,
  type OperationalContextReference,
  type OperationalContextRole,
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
  'patients.read',
  'patients.link',
  'patients.unlink',
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
  user_id: string;
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
  id: string;
  user_id: string;
  display_name: string | null;
  verification_status: unknown;
  professional_types: {
    code: string;
    display_name: string;
    verification_required: boolean;
    is_active: boolean;
  } | null;
};

type AuthorizationContextOptions = {
  requestedOperationalContext?: OperationalContextReference;
};

type OperationalContextResolutionInput = {
  memberships: MembershipRow[];
  professionalProfiles: ProfessionalProfileRow[];
  organizationTypeById: ReadonlyMap<string, OrganizationTypeRow>;
  rolesByMembershipId: ReadonlyMap<string, OperationalContextRole[]>;
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

function isSelectableProfessionalProfile(profile: ProfessionalProfileRow): boolean {
  const verificationStatus = professionalVerificationStatusSchema.safeParse(profile.verification_status);
  const type = profile.professional_types;
  return Boolean(
    type?.is_active
    && verificationStatus.success
    && verificationStatus.data !== 'rejected'
    && verificationStatus.data !== 'suspended',
  );
}

function isOperationalProfessionalProfile(profile: ProfessionalProfileRow): boolean {
  const verificationStatus = professionalVerificationStatusSchema.safeParse(profile.verification_status);
  const type = profile.professional_types;
  return Boolean(
    type?.is_active
    && verificationStatus.success
    && (!type.verification_required || verificationStatus.data === 'verified'),
  );
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

function compareContexts(left: OperationalContext, right: OperationalContext): number {
  return left.label.localeCompare(right.label, 'it', { sensitivity: 'base' })
    || left.kind.localeCompare(right.kind)
    || getOperationalContextId(left).localeCompare(getOperationalContextId(right));
}

export function getOperationalContextId(context: OperationalContext): string {
  return context.kind === 'organization' ? context.organizationId : context.professionalProfileId;
}

/**
 * Derives the only contexts an account may enter from canonical ownership and
 * active membership rows. It deliberately accepts no browser-provided role,
 * membership, organization or profile identifiers.
 */
export function getAvailableOperationalContexts(
  userId: string,
  input: OperationalContextResolutionInput,
): OperationalContext[] {
  const personalContexts = input.professionalProfiles
    .filter((profile) => profile.user_id === userId && isSelectableProfessionalProfile(profile))
    .flatMap((profile): OperationalContext[] => {
      const type = profile.professional_types;
      if (!type) return [];

      return [{
        kind: 'personal_professional',
        professionalProfileId: profile.id,
        label: profile.display_name?.trim() || 'Il tuo studio',
        professionalTypeCode: type.code,
        professionalTypeDisplayName: type.display_name,
      }];
    });

  const organizationContexts = input.memberships
    .filter((membership) => (
      membership.user_id === userId
      && membership.status === 'active'
      && membership.organizations?.status === 'active'
    ))
    .flatMap((membership): OperationalContext[] => {
      const organization = membership.organizations;
      if (!organization) return [];

      const organizationType = input.organizationTypeById.get(organization.organization_type_id);
      return [{
        kind: 'organization',
        organizationId: organization.id,
        membershipId: membership.id,
        label: organization.display_name,
        organizationTypeCode: organizationType?.code ?? null,
        organizationTypeDisplayName: organizationType?.display_name ?? null,
        roles: input.rolesByMembershipId.get(membership.id) ?? [],
      }];
    });

  return [...personalContexts, ...organizationContexts].sort(compareContexts);
}

/**
 * A missing or stale preference is never replaced with an arbitrary context.
 * The sole unambiguous case is one available context, which is auto-resolved.
 */
export function resolveOperationalContext(
  contexts: readonly OperationalContext[],
  requestedContext: OperationalContextReference | undefined,
): OperationalContext | null {
  if (requestedContext) {
    const matchingContext = contexts.find((context) => (
      context.kind === requestedContext.kind
      && getOperationalContextId(context) === requestedContext.id
    ));
    return matchingContext ?? (contexts.length === 1 ? contexts[0] ?? null : null);
  }

  return contexts.length === 1 ? contexts[0] ?? null : null;
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
      .select('id,user_id,organization_id,status,joined_at,organizations(id,display_name,legal_name,tax_identifier,email,phone,registered_address,status,organization_type_id)')
      .eq('user_id', user.id),
    db.from('roles').select('id,code,display_name,scope,is_active').eq('is_active', true),
    db.from('permissions').select('id,code'),
    db.from('role_permissions').select('role_id,permission_id'),
    db.from('account_roles').select('role_id').eq('user_id', user.id),
    db.from('organization_types').select('id,code,display_name').eq('is_active', true),
    db.from('professional_profiles')
      .select('id,user_id,display_name,verification_status,professional_types(code,display_name,verification_required,is_active)')
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
  const professionalProfileRows = (professionalProfileData ?? []) as ProfessionalProfileRow[];
  const professionalReadinessInputs = toProfessionalReadinessInputs(professionalProfileRows);

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

  const operationalRolesByMembership = new Map<string, OperationalContextRole[]>();
  const organizationPermissionsByMembership = new Map<string, BackendPermissionCode[]>();
  for (const membership of membershipRows) {
    const organizationRoleRecords = (memberRolesByMembership.get(membership.id) ?? [])
      .map((roleId) => roleById.get(roleId))
      .filter((role): role is RoleRow => Boolean(role && role.scope === 'organization'));

    operationalRolesByMembership.set(membership.id, organizationRoleRecords.map((role) => ({
      code: role.code,
      displayName: role.display_name,
    })));
    organizationPermissionsByMembership.set(
      membership.id,
      permissionsForRoles(organizationRoleRecords.map((role) => role.id)),
    );
  }

  const availableOperationalContexts = getAvailableOperationalContexts(user.id, {
    memberships: membershipRows,
    professionalProfiles: professionalProfileRows,
    organizationTypeById,
    rolesByMembershipId: operationalRolesByMembership,
  });
  const activeOperationalContext = resolveOperationalContext(
    availableOperationalContexts,
    options.requestedOperationalContext,
  );

  const activeOrganizationContext = activeOperationalContext?.kind === 'organization'
    ? activeOperationalContext
    : null;
  const activeMembership = activeOrganizationContext
    ? membershipRows.find((membership) => membership.id === activeOrganizationContext.membershipId) ?? null
    : null;
  const activeProfessionalProfile = activeOperationalContext?.kind === 'personal_professional'
    ? professionalProfileRows.find((profile) => profile.id === activeOperationalContext.professionalProfileId) ?? null
    : null;

  let hasActiveManager = false;
  if (activeOrganizationContext) {
    const { data: organizationMembersData, error: organizationMembersError } = await db
      .from('organization_members')
      .select('id')
      .eq('organization_id', activeOrganizationContext.organizationId)
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

  const platformRoleRecords = accountRoles
    .map((assignment) => roleById.get(assignment.role_id))
    .filter((role): role is RoleRow => Boolean(role && role.scope === 'platform'));
  const globalPermissions: BackendPermissionCode[] = [
    'profile.read_own',
    'profile.update_own',
  ];
  if (profileRow.onboarding_status === 'completed') globalPermissions.push('dashboard.access');
  globalPermissions.push(...permissionsForRoles(platformRoleRecords.map((role) => role.id)));

  const operationalPermissions = activeOperationalContext?.kind === 'organization'
    ? organizationPermissionsByMembership.get(activeOperationalContext.membershipId) ?? []
    : activeProfessionalProfile && isOperationalProfessionalProfile(activeProfessionalProfile)
      ? ['professional_profile.read_own', 'professional_profile.update_own', 'patients.read', 'patients.link', 'patients.unlink'] satisfies BackendPermissionCode[]
      : [];
  const operationalRoles = activeOperationalContext?.kind === 'organization'
    ? activeOperationalContext.roles
    : [];
  const readiness = getOperationalReadiness({
    personalProfile: {
      firstName: profileRow.first_name ?? null,
      lastName: profileRow.last_name ?? null,
      birthDate: profileRow.birth_date ?? null,
      taxCode: profileRow.tax_code ?? null,
      address: asAddress(profileRow.residential_address),
    },
    organization: activeMembership?.organizations ? {
      legalName: activeMembership.organizations.legal_name ?? null,
      displayName: activeMembership.organizations.display_name ?? null,
      organizationTypeId: activeMembership.organizations.organization_type_id ?? null,
      taxIdentifier: activeMembership.organizations.tax_identifier ?? null,
      email: activeMembership.organizations.email ?? null,
      phone: activeMembership.organizations.phone ?? null,
      address: asAddress(activeMembership.organizations.registered_address),
      hasActiveManager,
    } : null,
    professionalProfiles: professionalReadinessInputs,
    professionalIntent: professionalReadinessInputs.length > 0,
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
    availableOperationalContexts,
    activeOperationalContext,
    platformRoles: platformRoleRecords.map((role) => ({ code: role.code, displayName: role.display_name })),
    operationalRoles,
    globalPermissions: unique(globalPermissions),
    operationalPermissions: unique(operationalPermissions),
    permissions: unique([...globalPermissions, ...operationalPermissions]),
    readiness,
  };
}
