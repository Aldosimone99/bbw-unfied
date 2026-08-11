import { createClient } from "../../lib/supabase/server";
import { mapAuthError, type AuthApplicationError } from "../../features/auth/errors/map-auth-error";
import type {
  LoginInput,
  OnboardingAccountTypeInput,
  OnboardingProfileInput,
  RegisterInput
} from "../../lib/validation/auth";
import { requestBackend } from "../backend/server-request";
import { requestTransitionBackend } from "../auth/transition-session";

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

export type RegisterResult =
  | { status: "redirect" }
  | { status: "error"; error: AuthApplicationError };

export async function registerAccount(input: RegisterInput): Promise<RegisterResult> {
  const response = await requestBackend<{ userId?: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      accept_terms: input.acceptTerms,
      accept_privacy: input.acceptPrivacy,
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

export type OnboardingResult =
  | { status: "success" }
  | { status: "unauthorized" }
  | { status: "error" };

export async function saveOnboardingProfile(input: OnboardingProfileInput): Promise<OnboardingResult> {
  const response = await requestTransitionBackend("/auth/onboarding/profile", {
    method: "POST",
    body: JSON.stringify({ nome: input.firstName, cognome: input.lastName, telefono: input.phone ?? null })
  });

  if (response.status === 401) return { status: "unauthorized" };
  return response.ok ? { status: "success" } : { status: "error" };
}

export async function completeOnboarding(input: OnboardingAccountTypeInput): Promise<OnboardingResult> {
  const response = await requestTransitionBackend("/auth/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({
      account_type: input.accountType,
      organization_display_name: input.organizationDisplayName ?? null
    })
  });

  if (response.status === 401) return { status: "unauthorized" };
  return response.ok ? { status: "success" } : { status: "error" };
}
