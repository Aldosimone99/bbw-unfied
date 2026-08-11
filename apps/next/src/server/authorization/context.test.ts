import { describe, expect, it } from "vitest";

import type { MembershipSummary, PermissionCode } from "../../types/authorization";
import { resolveEffectivePermissions, selectActiveOrganization } from "./context";

function membership(id: string, status: string): MembershipSummary {
  return {
    id,
    organizationId: `organization-${id}`,
    organizationDisplayName: `Organization ${id}`,
    organizationTypeCode: "independent_practice",
    organizationTypeDisplayName: "Studio professionale",
    organizationStatus: "active",
    status,
    joinedAt: null,
    roles: []
  };
}

describe("active organization selection", () => {
  it("selects the only active membership", () => {
    expect(selectActiveOrganization([membership("one", "active")])?.id).toBe("one");
  });

  it("uses the valid cookie when multiple memberships are active", () => {
    expect(selectActiveOrganization([membership("one", "active"), membership("two", "active")], "organization-two")?.id).toBe("two");
  });

  it("falls back deterministically when the cookie is invalid", () => {
    expect(selectActiveOrganization([membership("one", "active"), membership("two", "active")], "organization-missing")?.id).toBe("one");
  });

  it("ignores pending memberships", () => {
    expect(selectActiveOrganization([membership("pending", "pending"), membership("one", "active")])?.id).toBe("one");
  });
});

describe("scoped permission resolution", () => {
  it("does not leak organization A permissions into organization B", () => {
    const organizationA = membership("a", "active");
    const organizationB = membership("b", "active");
    const permissionsByMembership = new Map<string, PermissionCode[]>([
      [organizationA.id, ["organization.members.manage"]],
      [organizationB.id, ["organization.read"]]
    ]);

    expect(resolveEffectivePermissions({
      globalPermissions: ["dashboard.access"],
      organizationPermissionsByMembershipId: permissionsByMembership,
      activeOrganization: organizationA
    })).toMatchObject({
      organizationPermissions: ["organization.members.manage"],
      permissions: ["dashboard.access", "organization.members.manage"]
    });

    expect(resolveEffectivePermissions({
      globalPermissions: ["dashboard.access"],
      organizationPermissionsByMembershipId: permissionsByMembership,
      activeOrganization: organizationB
    })).toMatchObject({
      organizationPermissions: ["organization.read"],
      permissions: ["dashboard.access", "organization.read"]
    });
  });
});
