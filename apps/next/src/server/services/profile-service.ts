import { AppError, UnauthenticatedError } from "../../lib/errors/app-error";
import type { ProfileUpdateInput } from "../../lib/validation/profile";
import { requestTransitionBackend } from "../auth/transition-session";
import { requirePermission } from "../authorization/permissions";

export async function updateOwnProfile(input: ProfileUpdateInput): Promise<void> {
  await requirePermission("profile.update_own");

  const response = await requestTransitionBackend("/auth/me", {
    method: "PUT",
    body: JSON.stringify({ nome: input.firstName, cognome: input.lastName, telefono: input.phone ?? null })
  });

  if (response.status === 401) throw new UnauthenticatedError();
  if (!response.ok) throw new AppError("INFRASTRUCTURE", "Profile could not be updated.");
}
