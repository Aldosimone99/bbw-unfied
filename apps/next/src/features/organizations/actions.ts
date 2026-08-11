"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AppError } from "../../lib/errors/app-error";
import { setActiveOrganization } from "../../server/services/active-organization-service";

export type SetActiveOrganizationActionState = {
  status: "idle" | "error";
  message?: string;
};

export async function setActiveOrganizationAction(
  _previousState: SetActiveOrganizationActionState,
  formData: FormData
): Promise<SetActiveOrganizationActionState> {
  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string") {
    return { status: "error", message: "Seleziona un’organizzazione." };
  }

  try {
    await setActiveOrganization(organizationId);
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
      return { status: "error", message: "La sessione non è valida. Accedi di nuovo." };
    }

    if (error instanceof AppError && error.code === "INVALID_INPUT") {
      return { status: "error", message: "Seleziona un’organizzazione valida." };
    }

    if (error instanceof AppError && error.code === "FORBIDDEN") {
      return { status: "error", message: "Non puoi accedere a questa organizzazione." };
    }

    return { status: "error", message: "Non è stato possibile cambiare organizzazione." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
