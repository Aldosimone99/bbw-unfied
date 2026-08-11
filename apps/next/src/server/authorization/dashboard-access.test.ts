import { describe, expect, it } from "vitest";

import { resolveDashboardAccess } from "./dashboard-access";

describe("dashboard access decisions", () => {
  it("sends an unauthenticated account to login", () => {
    expect(
      resolveDashboardAccess({ authenticated: false, onboardingStatus: null, hasDashboardPermission: false })
    ).toBe("login");
  });

  it("sends an incomplete profile to onboarding", () => {
    expect(
      resolveDashboardAccess({ authenticated: true, onboardingStatus: "profile_required", hasDashboardPermission: false })
    ).toBe("onboarding");

    expect(
      resolveDashboardAccess({ authenticated: true, onboardingStatus: "account_type_required", hasDashboardPermission: false })
    ).toBe("onboarding");
  });

  it("forbids a completed profile without dashboard permission", () => {
    expect(
      resolveDashboardAccess({ authenticated: true, onboardingStatus: "completed", hasDashboardPermission: false })
    ).toBe("forbidden");
  });

  it("allows a completed profile with dashboard permission", () => {
    expect(
      resolveDashboardAccess({ authenticated: true, onboardingStatus: "completed", hasDashboardPermission: true })
    ).toBe("allowed");
  });
});
