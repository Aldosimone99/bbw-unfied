"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getFieldErrors, type FieldErrors } from "../../lib/validation/action-errors";
import {
  loginInputSchema,
  onboardingAccountTypeInputSchema,
  onboardingProfileInputSchema,
  registerInputSchema
} from "../../lib/validation/auth";
import { resolveApplicationOrigin } from "../../lib/utils/application-origin";
import {
  completeOnboarding,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveOnboardingProfile
} from "../../server/services/auth-service";
import { resolvePostLoginDestination } from "../../server/services/post-login-service";

export type LoginActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
};

export type RegisterActionState = {
  status: "idle" | "error" | "email_confirmation";
  message?: string;
  fieldErrors?: FieldErrors;
};

export type OnboardingActionState = {
  status: "idle" | "error" | "success";
  step: "profile" | "account_type";
  message?: string;
  fieldErrors?: FieldErrors;
};

export async function logoutAction() {
  await logoutAccount();
  redirect("/login");
}

function getFormValue(formData: FormData, name: string): FormDataEntryValue | null {
  return formData.get(name);
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginInputSchema.safeParse({
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password"),
    redirectTo: getFormValue(formData, "redirectTo")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Controlla i campi evidenziati.",
      fieldErrors: getFieldErrors(parsed.error)
    };
  }

  const result = await loginAccount(parsed.data);
  if (result.status === "success") {
    redirect(await resolvePostLoginDestination(parsed.data.redirectTo));
  }

  if (result.status === "configuration_error") {
    return {
      status: "error",
      message: result.message
    };
  }

  return {
    status: "error",
    message: result.error.message
  };
}

export async function registerAction(
  _previousState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const parsed = registerInputSchema.safeParse({
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password"),
    confirmPassword: getFormValue(formData, "confirmPassword"),
    acceptTerms: formData.has("acceptTerms"),
    acceptPrivacy: formData.has("acceptPrivacy")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Controlla i campi evidenziati.",
      fieldErrors: getFieldErrors(parsed.error)
    };
  }

  const requestHeaders = await headers();
  const origin = resolveApplicationOrigin(process.env.NEXT_PUBLIC_SITE_URL, requestHeaders.get("origin"));

  if (!origin) {
    return {
      status: "error",
      message: "Configurazione del sito incompleta. Imposta l’URL pubblico dell’applicazione."
    };
  }

  const result = await registerAccount(parsed.data, `${origin}/auth/callback`);

  if (result.status === "redirect") {
    redirect("/onboarding");
  }

  if (result.status === "email_confirmation") {
    return {
      status: "email_confirmation",
      message: "Controlla la tua email per confermare l’account e continuare."
    };
  }

  if (result.status === "configuration_error") {
    return {
      status: "error",
      message: result.message
    };
  }

  return {
    status: "error",
    message: result.error.message
  };
}

export async function onboardingAction(
  _previousState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const step = formData.get("step");

  if (step === "profile") {
    const parsed = onboardingProfileInputSchema.safeParse({
      firstName: getFormValue(formData, "firstName"),
      lastName: getFormValue(formData, "lastName"),
      phone: getFormValue(formData, "phone")
    });

    if (!parsed.success) {
      return {
        status: "error",
        step: "profile",
        message: "Completa i dati richiesti.",
        fieldErrors: getFieldErrors(parsed.error)
      };
    }

    const result = await saveOnboardingProfile(parsed.data);

    if (result.status === "unauthorized") {
      return {
        status: "error",
        step: "profile",
        message: "La sessione non è valida. Accedi di nuovo per continuare."
      };
    }

    if (result.status === "configuration_error") {
      return { status: "error", step: "profile", message: result.message };
    }

    if (result.status === "error") {
      return {
        status: "error",
        step: "profile",
        message: "Non è stato possibile salvare il profilo. Riprova."
      };
    }

    return {
      status: "success",
      step: "account_type",
      message: "Dati personali salvati. Ora scegli come vuoi iniziare."
    };
  }

  const parsed = onboardingAccountTypeInputSchema.safeParse({
    accountType: getFormValue(formData, "accountType"),
    organizationDisplayName: getFormValue(formData, "organizationDisplayName"),
    organizationTypeCode: getFormValue(formData, "organizationTypeCode")
  });

  if (!parsed.success) {
    return {
      status: "error",
      step: "account_type",
      message: "Completa i dati richiesti.",
      fieldErrors: getFieldErrors(parsed.error)
    };
  }

  const result = await completeOnboarding(parsed.data);

  if (result.status === "unauthorized") {
    return {
      status: "error",
      step: "account_type",
      message: "La sessione non è valida. Accedi di nuovo per continuare."
    };
  }

  if (result.status === "configuration_error") {
    return {
      status: "error",
      step: "account_type",
      message: result.message
    };
  }

  if (result.status === "error") {
    return {
      status: "error",
      step: "account_type",
      message: "Non è stato possibile salvare il profilo. Riprova."
    };
  }

  redirect("/dashboard");
}
