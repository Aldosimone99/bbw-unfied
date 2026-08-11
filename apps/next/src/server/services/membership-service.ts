import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "../../lib/supabase/server";
import { AuthorizationError } from "../../lib/errors/app-error";
import type { MembershipSummary } from "../../types/authorization";
import {
  findMemberRoleRows,
  findMembershipRows,
  findOrganizationsByIds,
  findRolesByIds,
  optionalRow,
  optionalString,
  requiredString,
  type Row
} from "../repositories/authorization-repository";

export type LoadedMembershipData = {
  memberships: MembershipSummary[];
  memberRoleRows: Row[];
  roleRows: Row[];
};

export async function loadMembershipDataFromClient(
  client: SupabaseClient,
  userId: string
): Promise<LoadedMembershipData> {
  const membershipRows = await findMembershipRows(client, userId);
  const membershipIds = membershipRows.map((row) => requiredString(row, "id"));
  const organizationIds = membershipRows.map((row) => requiredString(row, "organization_id"));
  const [organizationRows, memberRoleRows] = await Promise.all([
    findOrganizationsByIds(client, organizationIds),
    findMemberRoleRows(client, membershipIds)
  ]);

  const roleIds = [...new Set(memberRoleRows.map((row) => requiredString(row, "role_id")))];
  const roleRows = await findRolesByIds(client, roleIds);
  const organizations = new Map(organizationRows.map((row) => [requiredString(row, "id"), row]));
  const roles = new Map(
    roleRows.map((row) => [
      requiredString(row, "id"),
      { code: requiredString(row, "code"), displayName: requiredString(row, "display_name") }
    ])
  );
  const rolesByMembership = new Map<string, MembershipSummary["roles"]>();

  for (const assignment of memberRoleRows) {
    const membershipId = requiredString(assignment, "organization_member_id");
    const role = roles.get(requiredString(assignment, "role_id"));
    if (role) {
      rolesByMembership.set(membershipId, [...(rolesByMembership.get(membershipId) ?? []), role]);
    }
  }

  const memberships = membershipRows.map((row) => {
    const organizationId = requiredString(row, "organization_id");
    const organization = organizations.get(organizationId);
    const organizationType = organization ? optionalRow(organization, "organization_type") : null;

    return {
      id: requiredString(row, "id"),
      organizationId,
      organizationDisplayName: organization ? optionalString(organization, "display_name") : null,
      organizationTypeCode: organizationType ? optionalString(organizationType, "code") : null,
      organizationTypeDisplayName: organizationType ? optionalString(organizationType, "display_name") : null,
      organizationStatus: organization ? optionalString(organization, "status") : null,
      status: requiredString(row, "status"),
      joinedAt: optionalString(row, "joined_at"),
      roles: rolesByMembership.get(requiredString(row, "id")) ?? []
    };
  });

  return { memberships, memberRoleRows, roleRows };
}

export async function loadMembershipSummariesFromClient(
  client: SupabaseClient,
  userId: string
): Promise<MembershipSummary[]> {
  return (await loadMembershipDataFromClient(client, userId)).memberships;
}

export async function getUserMemberships(userId: string): Promise<MembershipSummary[]> {
  return loadMembershipSummariesFromClient(await createClient(), userId);
}

export async function getAccessibleOrganizations(userId: string): Promise<MembershipSummary[]> {
  const memberships = await getUserMemberships(userId);
  return memberships.filter(
    (membership) => membership.status === "active" && membership.organizationStatus === "active"
  );
}

export async function getMembershipForOrganization(input: {
  userId: string;
  organizationId: string;
}): Promise<MembershipSummary | null> {
  const membership = (await getUserMemberships(input.userId)).find(
    (candidate) => candidate.organizationId === input.organizationId
  );

  return membership ?? null;
}

export async function requireOrganizationMembership(input: {
  userId: string;
  organizationId: string;
}): Promise<MembershipSummary> {
  const membership = await getMembershipForOrganization(input);
  if (!membership || membership.status !== "active" || membership.organizationStatus !== "active") {
    throw new AuthorizationError("organization.membership");
  }

  return membership;
}
