import { describe, expect, it } from "vitest";

import type { PostLoginContext } from "./post-login-service";
import { resolveDestinationFromContext } from "./post-login-service";

const completedProfile = {
  id: "profile-1",
  userId: "user-1",
  firstName: "Aldo",
  lastName: "Simone",
  phone: null,
  requestedAccountType: "personal",
  accountTypeStatus: "not_required",
  onboardingStatus: "completed" as const
} as const;

function context(overrides: Partial<PostLoginContext> = {}): PostLoginContext {
  return {
    user: { id: "user-1", email: "user@example.com" },
    profile: completedProfile,
    memberships: [],
    globalPermissions: [],
    organizationPermissions: [],
    permissions: [],
    activeOrganization: null,
    ...overrides
  };
}

describe("resolveDestinationFromContext", () => {
  it("sends unauthenticated users to login", () => {
    expect(resolveDestinationFromContext(context({ user: null }))).toBe("/login");
  });

  it("sends transition users to the dashboard without a landing profile row", () => {
    expect(resolveDestinationFromContext(context({ profile: null }))).toBe("/dashboard");
    expect(
      resolveDestinationFromContext(
        context({ profile: { ...completedProfile, onboardingStatus: "context_required" } })
      )
    ).toBe("/dashboard");
  });

  it("sends platform administrators to the admin area", () => {
    expect(resolveDestinationFromContext(context({ permissions: ["platform.admin.access"] }))).toBe("/admin");
  });

  it("sends users with one active organization to the dashboard", () => {
    expect(
      resolveDestinationFromContext(
        context({
          memberships: [
            {
              id: "membership-1",
              organizationId: "organization-1",
              organizationDisplayName: "Studio BBW",
              organizationTypeCode: "independent_practice",
              organizationTypeDisplayName: "Studio professionale",
              organizationStatus: "active",
              status: "active",
              joinedAt: null,
              roles: []
            }
          ]
        })
      )
    ).toBe("/dashboard");
  });

  it("sends users with multiple active organizations to the dashboard", () => {
    expect(
      resolveDestinationFromContext(
        context({
          memberships: [
            {
              id: "membership-1",
              organizationId: "organization-1",
              organizationDisplayName: "Studio BBW",
              organizationTypeCode: "independent_practice",
              organizationTypeDisplayName: "Studio professionale",
              organizationStatus: "active",
              status: "active",
              joinedAt: null,
              roles: []
            },
            {
              id: "membership-2",
              organizationId: "organization-2",
              organizationDisplayName: "Clinica BBW",
              organizationTypeCode: "healthcare_facility",
              organizationTypeDisplayName: "Struttura sanitaria",
              organizationStatus: "active",
              status: "active",
              joinedAt: null,
              roles: []
            }
          ]
        })
      )
    ).toBe("/dashboard");
  });
});
