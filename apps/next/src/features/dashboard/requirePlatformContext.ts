import { forbidden, redirect } from "next/navigation";

import { hasPermission } from "../../server/authorization/permissions";
import { resolveDashboardAccess } from "../../server/authorization/dashboard-access";
import { getPostLoginContext, type PostLoginContext } from "../../server/services/post-login-service";

export type AuthorizedPlatformContext = PostLoginContext & {
  user: NonNullable<PostLoginContext["user"]>;
  profile: NonNullable<PostLoginContext["profile"]>;
};

export async function requireActiveOrganization() {
  const context = await getPostLoginContext();
  if (!context.user) {
    redirect("/login");
  }

  if (!context.activeOrganization) {
    forbidden();
  }

  return context.activeOrganization;
}

export async function requirePlatformContext(): Promise<AuthorizedPlatformContext> {
  const context = await getPostLoginContext();
  const decision = resolveDashboardAccess({
    authenticated: context.user !== null,
    onboardingStatus: context.profile?.onboardingStatus ?? null,
    hasDashboardPermission: hasPermission(new Set(context.permissions), "dashboard.access")
  });

  if (decision === "login") redirect("/login");
  if (decision === "onboarding") redirect("/onboarding");
  if (decision === "forbidden") forbidden();

  if (!context.user || !context.profile) {
    redirect("/login");
  }

  return context as AuthorizedPlatformContext;
}
