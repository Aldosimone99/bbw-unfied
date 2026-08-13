"use server";

import { companyInviteAcceptSchema, patientInvitationAcceptRequestSchema } from '@bbw/interfaces';
import { redirect } from "next/navigation";

import { getFieldErrors, type FieldErrors } from "../../lib/validation/action-errors";
import {
  loginInputSchema,
  onboardingAccountTypeInputSchema,
  onboardingProfileInputSchema,
  registerInputSchema
} from "../../lib/validation/auth";
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
  status: "idle" | "error";
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
  redirect("/accedi");
}

function getFormValue(formData: FormData, name: string): FormDataEntryValue | null {
  return formData.get(name);
}

const onboardingAccountTypeAliases: Record<string, string> = {
  cliente: "personal",
  medico: "healthcare_professional",
  estetista: "beauty_professional",
  clinica: "organization",
  commerciale: "commercial"
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const rawInvitationToken = getFormValue(formData, "invitationToken");
  const invitationToken = companyInviteAcceptSchema.safeParse({
    token: typeof rawInvitationToken === 'string' ? rawInvitationToken : '',
  });
  const rawPatientInvitationToken = getFormValue(formData, "patientInvitationToken");
  const patientInvitationToken = patientInvitationAcceptRequestSchema.safeParse({
    token: typeof rawPatientInvitationToken === 'string' ? rawPatientInvitationToken : '',
  });
  const parsed = loginInputSchema.safeParse({
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password"),
    redirectTo: invitationToken.success ? undefined : getFormValue(formData, "redirectTo")
  });

  if (!parsed.success) {
    return { status: "error", message: "Controlla i campi evidenziati.", fieldErrors: getFieldErrors(parsed.error) };
  }

  const result = await loginAccount(parsed.data);
  if (result.status === "success") {
    const requestedRedirect = patientInvitationToken.success
      ? `/inviti/paziente/accetta?${new URLSearchParams({ token: patientInvitationToken.data.token }).toString()}`
      : invitationToken.success
        ? `/inviti/accetta?${new URLSearchParams({ token: invitationToken.data.token }).toString()}`
        : parsed.data.redirectTo;
    redirect(await resolvePostLoginDestination(requestedRedirect));
  }

  return { status: "error", message: result.error.message };
}

export async function registerAction(
  _previousState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const rawRedirectTo = getFormValue(formData, "redirectTo");
  const redirectTo = typeof rawRedirectTo === 'string' ? rawRedirectTo : undefined;
  const rawInvitationToken = getFormValue(formData, "invitationToken");
  const invitationToken = companyInviteAcceptSchema.safeParse({
    token: typeof rawInvitationToken === 'string' ? rawInvitationToken : '',
  });
  const rawPatientInvitationToken = getFormValue(formData, "patientInvitationToken");
  const patientInvitationToken = patientInvitationAcceptRequestSchema.safeParse({
    token: typeof rawPatientInvitationToken === 'string' ? rawPatientInvitationToken : '',
  });
  const parsed = registerInputSchema.safeParse({
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password"),
    confirmPassword: getFormValue(formData, "confirmPassword"),
    acceptTerms: formData.has("acceptTerms"),
    acceptPrivacy: formData.has("acceptPrivacy")
  });

  if (!parsed.success) {
    return { status: "error", message: "Controlla i campi evidenziati.", fieldErrors: getFieldErrors(parsed.error) };
  }

  const result = await registerAccount(parsed.data);
  if (result.status === "redirect") {
    const onboardingParams = new URLSearchParams();
    if (redirectTo) onboardingParams.set("redirectTo", redirectTo);
    if (patientInvitationToken.success) {
      onboardingParams.set("patientInvitationToken", patientInvitationToken.data.token);
      redirect(`/onboarding?${onboardingParams.toString()}`);
    }
    if (invitationToken.success) {
      onboardingParams.set("invitationToken", invitationToken.data.token);
      redirect(`/onboarding?${onboardingParams.toString()}`);
    }
    redirect(await resolvePostLoginDestination(redirectTo));
  }
  return { status: "error", message: result.error.message };
}

export async function onboardingAction(
  _previousState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const step = formData.get("step");

  if (step === "profile") {
    const rawRedirectTo = getFormValue(formData, "redirectTo");
    const redirectTo = typeof rawRedirectTo === 'string' ? rawRedirectTo : undefined;
    const parsed = onboardingProfileInputSchema.safeParse({
      firstName: getFormValue(formData, "firstName"),
      lastName: getFormValue(formData, "lastName"),
      phone: getFormValue(formData, "phone")
    });

    if (!parsed.success) {
      return { status: "error", step: "profile", message: "Completa i dati richiesti.", fieldErrors: getFieldErrors(parsed.error) };
    }

    const result = await saveOnboardingProfile(parsed.data);
    if (result.status === "unauthorized") return { status: "error", step: "profile", message: "La sessione non è valida. Accedi di nuovo." };
    if (result.status === "error") return { status: "error", step: "profile", message: "Non è stato possibile salvare il profilo. Riprova." };

    return { status: "success", step: "account_type", message: "Dati personali salvati. Ora scegli come vuoi iniziare." };
  }

  const rawRedirectTo = getFormValue(formData, "redirectTo");
  const redirectTo = typeof rawRedirectTo === 'string' ? rawRedirectTo : undefined;
  const rawAccountType = getFormValue(formData, "accountType");
  const parsed = onboardingAccountTypeInputSchema.safeParse({
    accountType: typeof rawAccountType === "string"
      ? onboardingAccountTypeAliases[rawAccountType] ?? rawAccountType
      : rawAccountType,
    organizationDisplayName: getFormValue(formData, "organizationDisplayName")
  });

  if (!parsed.success) {
    return { status: "error", step: "account_type", message: "Completa i dati richiesti.", fieldErrors: getFieldErrors(parsed.error) };
  }

  const result = await completeOnboarding(parsed.data);
  if (result.status === "unauthorized") return { status: "error", step: "account_type", message: "La sessione non è valida. Accedi di nuovo." };
  if (result.status === "error") return { status: "error", step: "account_type", message: "Non è stato possibile completare il profilo. Riprova." };

  const rawPatientInvitationToken = getFormValue(formData, "patientInvitationToken");
  const patientInvitationToken = patientInvitationAcceptRequestSchema.safeParse({
    token: typeof rawPatientInvitationToken === 'string' ? rawPatientInvitationToken : '',
  });
  if (patientInvitationToken.success) {
    redirect(`/inviti/paziente/accetta?${new URLSearchParams({ token: patientInvitationToken.data.token }).toString()}`);
  }

  const rawInvitationToken = getFormValue(formData, "invitationToken");
  const invitationToken = companyInviteAcceptSchema.safeParse({
    token: typeof rawInvitationToken === 'string' ? rawInvitationToken : '',
  });
  if (invitationToken.success) {
    redirect(`/inviti/accetta?${new URLSearchParams({ token: invitationToken.data.token }).toString()}`);
  }

  redirect(await resolvePostLoginDestination(redirectTo));
}
