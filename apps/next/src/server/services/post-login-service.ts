import { getTransitionOrganizationContext, getTransitionUser, profileFromTransitionUser } from "../auth/transition-session";
import type { PermissionCode } from "../../types/authorization";
import { resolveSafePostLoginRedirect, type PostLoginRedirectPath } from "../security/redirects";

export type PostLoginDestination = PostLoginRedirectPath;

export type PostLoginContext = {
  user: { id: string; email: string | null } | null;
  profile: ReturnType<typeof profileFromTransitionUser> | null;
  memberships: Awaited<ReturnType<typeof getTransitionOrganizationContext>>["memberships"];
  globalPermissions: PermissionCode[];
  organizationPermissions: PermissionCode[];
  permissions: PermissionCode[];
  activeOrganization: Awaited<ReturnType<typeof getTransitionOrganizationContext>>["activeOrganization"];
};

export async function getPostLoginContext(): Promise<PostLoginContext> {
  const transitionUser = await getTransitionUser();
  if (!transitionUser) {
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

  const organizationContext = await getTransitionOrganizationContext(transitionUser.id);
  const permissions: PermissionCode[] = ["dashboard.access", "profile.read_own", "profile.update_own"];
  if (transitionUser.tipo_utente === "admin") permissions.push("platform.admin.access");

  return {
    user: { id: transitionUser.id, email: transitionUser.email ?? null },
    profile: profileFromTransitionUser(transitionUser),
    ...organizationContext,
    globalPermissions: permissions,
    organizationPermissions: [],
    permissions
  };
}

export function resolveDestinationFromContext(context: PostLoginContext): PostLoginDestination {
  if (!context.user) return "/login";
  if (context.permissions.includes("platform.admin.access")) return "/admin";
  return "/dashboard";
}

export async function resolvePostLoginDestination(requestedRedirect?: string): Promise<string> {
  return resolveSafePostLoginRedirect(requestedRedirect, resolveDestinationFromContext(await getPostLoginContext()));
}
