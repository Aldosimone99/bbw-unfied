import { createClient } from "../../lib/supabase/server";
import { AppError, UnauthenticatedError } from "../../lib/errors/app-error";
import type { ProfileUpdateInput } from "../../lib/validation/profile";
import { requirePermission } from "../authorization/permissions";

export async function updateOwnProfile(input: ProfileUpdateInput): Promise<void> {
  await requirePermission("profile.update_own");

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    throw new UnauthenticatedError();
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone ?? null
    })
    .eq("user_id", data.user.id);

  if (error) {
    throw new AppError("INFRASTRUCTURE", "Profile could not be updated.");
  }
}
