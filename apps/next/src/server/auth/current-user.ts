import type { CurrentUser, ProfileSummary } from "../../types/authorization";
import { getTransitionAuthorizationContext } from "./transition-session";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const context = await getTransitionAuthorizationContext();
  if (!context) return null;

  return {
    id: context.user.id,
    email: context.user.email ?? null
  };
}

export async function getCurrentProfile(): Promise<ProfileSummary | null> {
  const context = await getTransitionAuthorizationContext();
  return context?.profile ?? null;
}
