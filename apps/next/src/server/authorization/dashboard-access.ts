import type { ProfileSummary } from "../../types/authorization";

export type DashboardAccessDecision = "login" | "onboarding" | "forbidden" | "allowed";

export function resolveDashboardAccess(input: {
  authenticated: boolean;
  onboardingStatus: ProfileSummary["onboardingStatus"] | null;
  hasDashboardPermission: boolean;
}): DashboardAccessDecision {
  if (!input.authenticated) {
    return "login";
  }

  if (input.onboardingStatus !== "completed") {
    return "onboarding";
  }

  return input.hasDashboardPermission ? "allowed" : "forbidden";
}
