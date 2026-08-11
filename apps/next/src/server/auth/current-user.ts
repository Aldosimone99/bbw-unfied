import type { CurrentUser, ProfileSummary } from "../../types/authorization";
import { getTransitionUser, profileFromTransitionUser } from "./transition-session";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const user = await getTransitionUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null
  };
}

export async function getCurrentProfile(): Promise<ProfileSummary | null> {
  const transitionUser = await getTransitionUser();
  return transitionUser ? profileFromTransitionUser(transitionUser) : null;
}
