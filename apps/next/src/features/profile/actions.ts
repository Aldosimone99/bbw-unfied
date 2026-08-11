"use server";

import { revalidatePath } from "next/cache";

import { AppError } from "../../lib/errors/app-error";
import { getFieldErrors, type FieldErrors } from "../../lib/validation/action-errors";
import { profileUpdateInputSchema } from "../../lib/validation/profile";
import { updateOwnProfile } from "../../server/services/profile-service";

export type ProfileActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
};

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const parsed = profileUpdateInputSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Controlla i dati inseriti.",
      fieldErrors: getFieldErrors(parsed.error)
    };
  }

  try {
    await updateOwnProfile(parsed.data);
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
      return { status: "error", message: "La sessione non è valida. Accedi di nuovo." };
    }

    if (error instanceof AppError && error.code === "FORBIDDEN") {
      return { status: "error", message: "Non hai il permesso di modificare questo profilo." };
    }

    return { status: "error", message: "Non è stato possibile salvare il profilo. Riprova." };
  }

  revalidatePath("/profilo");
  revalidatePath("/dashboard");

  return { status: "success", message: "Profilo aggiornato." };
}
