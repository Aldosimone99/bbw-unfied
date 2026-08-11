"use server";

import { redirect } from "next/navigation";

import { getFieldErrors, type FieldErrors } from "../../lib/validation/action-errors";
import { loginInputSchema, registerInputSchema } from "../../lib/validation/auth";
import {
  loginAccount,
  logoutAccount,
  requestRegistrationOtp,
  registerAccount
} from "../../server/services/auth-service";
import { resolvePostLoginDestination } from "../../server/services/post-login-service";

export type LoginActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
};

export type RegisterActionState = {
  status: "idle" | "error" | "otp_sent";
  message?: string;
  fieldErrors?: FieldErrors;
  otpReference?: string;
  devOtpCode?: string;
};

export async function logoutAction() {
  await logoutAccount();
  redirect("/accedi");
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
    return { status: "error", message: "Controlla i campi evidenziati.", fieldErrors: getFieldErrors(parsed.error) };
  }

  const result = await loginAccount(parsed.data);
  if (result.status === "success") redirect(await resolvePostLoginDestination(parsed.data.redirectTo));

  return { status: "error", message: result.error.message };
}

export async function registerAction(
  previousState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  if (formData.get("_action") === "send_otp") {
    const email = String(getFormValue(formData, "email") ?? "").trim();
    const parsedEmail = registerInputSchema.shape.email.safeParse(email);
    if (!parsedEmail.success) {
      return { status: "error", message: "Inserisci prima un indirizzo email valido.", fieldErrors: { email: ["Inserisci un indirizzo email valido."] } };
    }

    const otp = await requestRegistrationOtp(parsedEmail.data);
    if (otp.status === "error") return { status: "error", message: otp.message };
    return {
      status: "otp_sent",
      message: "Codice inviato. Inseriscilo per verificare l’email.",
      otpReference: otp.reference,
      devOtpCode: otp.code
    };
  }

  const parsed = registerInputSchema.safeParse({
    tipoUtente: getFormValue(formData, "tipoUtente"),
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password"),
    confirmPassword: getFormValue(formData, "confirmPassword"),
    nome: getFormValue(formData, "nome"),
    cognome: getFormValue(formData, "cognome"),
    codiceFiscale: getFormValue(formData, "codiceFiscale"),
    ragioneSociale: getFormValue(formData, "ragioneSociale"),
    partitaIva: getFormValue(formData, "partitaIva"),
    studioCitta: getFormValue(formData, "studioCitta"),
    numeroAlbo: getFormValue(formData, "numeroAlbo"),
    otpReference: getFormValue(formData, "otpReference"),
    otpCode: getFormValue(formData, "otpCode"),
    acceptTerms: formData.has("acceptTerms"),
    acceptPrivacy: formData.has("acceptPrivacy")
  });

  if (!parsed.success) {
    return { status: "error", message: "Controlla i campi evidenziati.", fieldErrors: getFieldErrors(parsed.error), otpReference: previousState.otpReference, devOtpCode: previousState.devOtpCode };
  }

  const result = await registerAccount(parsed.data);
  if (result.status === "redirect") redirect("/dashboard");
  return { status: "error", message: result.error.message, otpReference: previousState.otpReference, devOtpCode: previousState.devOtpCode };
}
