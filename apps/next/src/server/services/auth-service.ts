import { createClient } from "../../lib/supabase/server";
import { mapAuthError, type AuthApplicationError } from "../../features/auth/errors/map-auth-error";
import type { LoginInput, RegisterInput } from "../../lib/validation/auth";
import { requestBackend } from "../backend/server-request";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function backendError(data: unknown, status: number): AuthApplicationError {
  const code = typeof data === "object" && data !== null && "error" in data
    ? String((data as { error?: unknown }).error ?? "")
    : undefined;
  return mapAuthError({ code, status }, status === 401 ? "login" : "register");
}

function getSupabaseConfigurationMessage(error: unknown): string | null {
  return error instanceof Error && error.message === "Missing public Supabase environment variables."
    ? "Supabase non è configurato. Verifica le variabili d’ambiente del deployment."
    : null;
}

export type RegistrationOtpResult =
  | { status: "success"; reference: string; code?: string }
  | { status: "error"; message: string };

export async function requestRegistrationOtp(email: string): Promise<RegistrationOtpResult> {
  const response = await requestBackend<{ reference?: string; code?: string }>("/auth/otp/send", {
    method: "POST",
    body: JSON.stringify({ email, purpose: "registration" })
  });

  if (!response.ok || !response.data.reference) {
    return { status: "error", message: "Non è stato possibile inviare il codice email." };
  }

  return { status: "success", reference: response.data.reference, code: response.data.code };
}

export type RegisterResult =
  | { status: "redirect" }
  | { status: "error"; error: AuthApplicationError };

export async function registerAccount(input: RegisterInput): Promise<RegisterResult> {
  const verifyResponse = await requestBackend("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      reference: input.otpReference,
      code: input.otpCode,
      purpose: "registration"
    })
  });

  if (!verifyResponse.ok) {
    return { status: "error", error: { kind: "generic", message: "Il codice email non è valido o è scaduto." } };
  }

  const response = await requestBackend<{ userId?: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      tipo_utente: input.tipoUtente,
      email: input.email,
      password: input.password,
      otp_reference: input.otpReference,
      accept_terms: input.acceptTerms,
      accept_privacy: input.acceptPrivacy,
      nome: input.nome,
      cognome: input.cognome,
      codice_fiscale: input.codiceFiscale,
      ragione_sociale: input.ragioneSociale,
      partita_iva: input.partitaIva,
      studio_citta: input.studioCitta,
      numero_albo: input.numeroAlbo,
      consenso_marketing: false,
      consenso_profilazione: false
    })
  });

  if (!response.ok) {
    return { status: "error", error: backendError(response.data, response.status) };
  }

  const signInResult = await signInWithSupabase(input.email, input.password);
  return signInResult.status === "success" ? { status: "redirect" } : signInResult;
}

export type LoginResult =
  | { status: "success" }
  | { status: "error"; error: AuthApplicationError };

export async function loginAccount(input: LoginInput): Promise<LoginResult> {
  const response = await requestBackend("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: input.email, password: input.password })
  });

  if (!response.ok) {
    return { status: "error", error: backendError(response.data, response.status) };
  }

  return signInWithSupabase(input.email, input.password);
}

async function signInWithSupabase(email: string, password: string): Promise<LoginResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch (error) {
    const message = getSupabaseConfigurationMessage(error);
    if (message) return { status: "error", error: { kind: "generic", message } };
    throw error;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { status: "error", error: mapAuthError(error, "login") };
  }

  return { status: "success" };
}

export async function logoutAccount(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
