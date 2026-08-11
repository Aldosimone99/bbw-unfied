import type { SupabaseClient } from "@supabase/supabase-js";

import type { MembershipSummary, PermissionCode } from "../../types/authorization";
import { permissionCodes } from "../../types/authorization";
import { getRequestedActiveOrganizationId, resolveActiveOrganization } from "../services/active-organization-service";
import { loadMembershipDataFromClient } from "../services/membership-service";
import {
  findAccountRoleRows,
  findPermissionsByIds,
  findRolePermissionRows,
  findRolesByIds,
  requiredString
} from "../repositories/authorization-repository";

export type LoadedAuthorizationContext = {
  memberships: MembershipSummary[];
  globalPermissions: PermissionCode[];
  organizationPermissions: PermissionCode[];
  permissions: PermissionCode[];
  activeOrganization: MembershipSummary | null;
};

const permissionCodeSet = new Set<string>(permissionCodes);

export function selectActiveOrganization(
  memberships: MembershipSummary[],
  requestedOrganizationId: string | null = null
): MembershipSummary | null {
  return resolveActiveOrganization(memberships, requestedOrganizationId);
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

export async function loadAuthorizationContext(
  client: SupabaseClient,
  userId: string,
  requestedOrganizationId?: string | null
): Promise<LoadedAuthorizationContext> {
  const membershipData = await loadMembershipDataFromClient(client, userId);
  const { memberships, memberRoleRows: loadedMemberRoleRows, roleRows } = membershipData;
  const memberRoleRows = loadedMemberRoleRows;
  const accountRoleRows = await findAccountRoleRows(client, userId);
  const memberAssignments = memberRoleRows.map((row) => ({
    organizationMemberId: requiredString(row, "organization_member_id"),
    roleId: requiredString(row, "role_id")
  }));
  const accountAssignments = accountRoleRows.map((row) => requiredString(row, "role_id"));
  const allRoleIds = [...new Set([...memberAssignments.map((row) => row.roleId), ...accountAssignments])];
  const loadedRoleIds = new Set(roleRows.map((row) => requiredString(row, "id")));
  const accountOnlyRoleIds = accountAssignments.filter((roleId) => !loadedRoleIds.has(roleId));
  const additionalRoleRows = await findRolesByIds(client, accountOnlyRoleIds);
  const allRoleRows = [...roleRows, ...additionalRoleRows];
  const roleScopes = new Map(allRoleRows.map((row) => [requiredString(row, "id"), row.scope]));
  const organizationRoleIdsByMembershipId = new Map<string, string[]>();

  for (const assignment of memberAssignments) {
    if (roleScopes.get(assignment.roleId) === "organization") {
      organizationRoleIdsByMembershipId.set(assignment.organizationMemberId, [
        ...(organizationRoleIdsByMembershipId.get(assignment.organizationMemberId) ?? []),
        assignment.roleId
      ]);
    }
  }

  const rolePermissionRows = await findRolePermissionRows(client, allRoleIds);
  const permissionIds = [...new Set(rolePermissionRows.map((row) => requiredString(row, "permission_id")))];
  const permissionRows = await findPermissionsByIds(client, permissionIds);
  const permissionCodesById = new Map(
    permissionRows.map((row) => [requiredString(row, "id"), requiredString(row, "code")])
  );
  const permissionCodesByRoleId = new Map<string, PermissionCode[]>();

  for (const mapping of rolePermissionRows) {
    const code = permissionCodesById.get(requiredString(mapping, "permission_id"));
    if (code && permissionCodeSet.has(code)) {
      permissionCodesByRoleId.set(requiredString(mapping, "role_id"), [
        ...(permissionCodesByRoleId.get(requiredString(mapping, "role_id")) ?? []),
        code as PermissionCode
      ]);
    }
  }

  const globalPermissions = accountAssignments
    .filter((roleId) => roleScopes.get(roleId) === "platform")
    .flatMap((roleId) => permissionCodesByRoleId.get(roleId) ?? []);
  const organizationPermissionsByMembershipId = new Map<string, PermissionCode[]>();

  for (const [membershipId, roleIds] of organizationRoleIdsByMembershipId) {
    organizationPermissionsByMembershipId.set(
      membershipId,
      roleIds.flatMap((roleId) => permissionCodesByRoleId.get(roleId) ?? [])
    );
  }

  const activeOrganization = selectActiveOrganization(
    memberships,
    requestedOrganizationId === undefined ? await getRequestedActiveOrganizationId() : requestedOrganizationId
  );
  const permissions = resolveEffectivePermissions({
    globalPermissions,
    organizationPermissionsByMembershipId,
    activeOrganization
  });

  return { memberships, activeOrganization, ...permissions };
}
