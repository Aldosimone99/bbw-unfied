import { createClient } from "../../lib/supabase/server";
import { hasPermission } from "../authorization/permissions";
import { findProfileByUserId } from "../repositories/authorization-repository";
import { loadAuthorizationContext, type LoadedAuthorizationContext } from "../authorization/context";
import { resolveSafePostLoginRedirect, type PostLoginRedirectPath } from "../security/redirects";

export type PostLoginDestination = PostLoginRedirectPath;

export type PostLoginContext = LoadedAuthorizationContext & {
  user: { id: string; email: string | null } | null;
  profile: Awaited<ReturnType<typeof findProfileByUserId>>;
};

export async function getPostLoginContext(): Promise<PostLoginContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
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

  const user = { id: data.user.id, email: data.user.email ?? null };
  const [profile, authorization] = await Promise.all([
    findProfileByUserId(supabase, user.id),
    loadAuthorizationContext(supabase, user.id)
  ]);

  return { user, profile, ...authorization };
}

export function resolveDestinationFromContext(context: PostLoginContext): PostLoginDestination {
  if (!context.user) {
    return "/login";
  }

  if (!context.profile || context.profile.onboardingStatus !== "completed") {
    return "/onboarding";
  }

  if (hasPermission(new Set(context.permissions), "platform.admin.access")) {
    return "/admin";
  }

  return "/dashboard";
}

export async function resolvePostLoginDestination(requestedRedirect?: string): Promise<string> {
  const canonicalDestination = resolveDestinationFromContext(await getPostLoginContext());
  return resolveSafePostLoginRedirect(requestedRedirect, canonicalDestination);
}
