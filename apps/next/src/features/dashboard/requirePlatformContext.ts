import { forbidden, redirect } from "next/navigation";

import { hasPermission } from "../../server/authorization/permissions";
import { getPostLoginContext, type PostLoginContext } from "../../server/services/post-login-service";
import { getTransitionRole, type TransitionRole } from "./transitionNavigation";

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

export async function requirePlatformContext(allowedRoles?: readonly TransitionRole[]): Promise<AuthorizedPlatformContext> {
  const context = await getPostLoginContext();
  if (!context.user) {
    redirect("/login");
  }
  if (context.profile?.onboardingStatus !== "completed") redirect("/onboarding");
  if (!hasPermission(new Set(context.permissions), "dashboard.access")) forbidden();
  if (allowedRoles && context.profile && !allowedRoles.includes(getTransitionRole(context.profile))) forbidden();
  if (!context.profile) redirect("/login");

  return context as AuthorizedPlatformContext;
}
