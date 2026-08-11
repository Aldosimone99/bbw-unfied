import type { MembershipSummary, PermissionCode } from "../../types/authorization";

/**
 * Compatibility types for server consumers. The data itself is loaded from
 * the backend /auth/context endpoint; this module contains no Supabase reads.
 */
export type LoadedAuthorizationContext = {
  memberships: MembershipSummary[];
  globalPermissions: PermissionCode[];
  organizationPermissions: PermissionCode[];
  permissions: PermissionCode[];
  activeOrganization: MembershipSummary | null;
};

export function selectActiveOrganization(
  memberships: MembershipSummary[],
  requestedOrganizationId: string | null = null
): MembershipSummary | null {
  const activeMemberships = memberships.filter(
    (membership) => membership.status === "active" && membership.organizationStatus === "active"
  );

  if (requestedOrganizationId) {
    return activeMemberships.find((membership) => membership.organizationId === requestedOrganizationId) ?? activeMemberships[0] ?? null;
  }

  return activeMemberships[0] ?? null;
}

export function resolveEffectivePermissions(input: {
  globalPermissions: PermissionCode[];
  organizationPermissionsByMembershipId: ReadonlyMap<string, PermissionCode[]>;
  activeOrganization: MembershipSummary | null;
}): {
  globalPermissions: PermissionCode[];
  organizationPermissions: PermissionCode[];
  permissions: PermissionCode[];
} {
  const globalPermissions = [...new Set(input.globalPermissions)];
  const organizationPermissions = input.activeOrganization
    ? [...new Set(input.organizationPermissionsByMembershipId.get(input.activeOrganization.id) ?? [])]
    : [];

  return {
    globalPermissions,
    organizationPermissions,
    permissions: [...new Set([...globalPermissions, ...organizationPermissions])]
  };
}
