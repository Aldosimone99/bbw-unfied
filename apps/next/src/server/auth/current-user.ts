import { createClient } from "../../lib/supabase/server";
import { AppError } from "../../lib/errors/app-error";
import type { CurrentUser, ProfileSummary } from "../../types/authorization";
import { findProfileByUserId } from "../repositories/authorization-repository";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null
  };
}

export async function getCurrentProfile(): Promise<ProfileSummary | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const supabase = await createClient();
  try {
    return await findProfileByUserId(supabase, user.id);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("INFRASTRUCTURE", "Profile could not be loaded.");
  }
}
