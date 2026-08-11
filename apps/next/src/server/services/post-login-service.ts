import { getTransitionAuthorizationContext } from "../auth/transition-session";
import type { OrganizationContextSummary, PermissionCode, ProfileSummary } from "../../types/authorization";
import { resolveSafePostLoginRedirect, type PostLoginRedirectPath } from "../security/redirects";

export type PostLoginDestination = PostLoginRedirectPath;

export type PostLoginContext = {
  user: { id: string; email: string | null } | null;
  profile: ProfileSummary | null;
  memberships: OrganizationContextSummary["memberships"];
  globalPermissions: PermissionCode[];
  organizationPermissions: PermissionCode[];
  permissions: PermissionCode[];
  activeOrganization: OrganizationContextSummary["activeOrganization"];
};

export async function getPostLoginContext(): Promise<PostLoginContext> {
  const authorizationContext = await getTransitionAuthorizationContext();
  if (!authorizationContext) {
    return {
      user: null,
      profile: null,
      memberships: [],
      globalPermissions: [],
      organizationPermissions: [],
      permissions: [],
      activeOrganization: null
    };
  }

  return {
    user: { id: authorizationContext.user.id, email: authorizationContext.user.email ?? null },
    profile: authorizationContext.profile,
    memberships: authorizationContext.memberships,
    activeOrganization: authorizationContext.activeOrganization,
    globalPermissions: authorizationContext.globalPermissions,
    organizationPermissions: authorizationContext.organizationPermissions,
    permissions: authorizationContext.permissions
  };
}

export function resolveDestinationFromContext(context: PostLoginContext): PostLoginDestination {
  if (!context.user) return "/login";
  if (context.profile?.onboardingStatus !== "completed") return "/onboarding";
  if (context.permissions.includes("platform.admin.access")) return "/admin";
  return "/dashboard";
}

export async function resolvePostLoginDestination(requestedRedirect?: string): Promise<string> {
  return resolveSafePostLoginRedirect(requestedRedirect, resolveDestinationFromContext(await getPostLoginContext()));
}
