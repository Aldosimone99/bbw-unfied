import { createClient } from "../../lib/supabase/server";
import { mapAuthError, type AuthApplicationError } from "../../features/auth/errors/map-auth-error";
import type {
  LoginInput,
  OnboardingAccountTypeInput,
  OnboardingProfileInput,
  RegisterInput
} from "../../lib/validation/auth";
import { findActiveOrganizationTypes } from "../repositories/authorization-repository";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function getSupabaseConfigurationMessage(error: unknown): string | null {
  return error instanceof Error && error.message === "Missing public Supabase environment variables."
    ? "Supabase non è configurato. Verifica le variabili d’ambiente del deployment."
    : null;
}

export type RegisterResult =
  | { status: "redirect" }
  | { status: "email_confirmation" }
  | { status: "configuration_error"; message: string }
  | { status: "error"; error: AuthApplicationError };

export async function registerAccount(input: RegisterInput, emailRedirectTo: string): Promise<RegisterResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch (error) {
    const message = getSupabaseConfigurationMessage(error);
    if (message) {
      return {
        status: "configuration_error",
        message
      };
    }
    throw error;
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo
    }
  });

  if (error || !data.user) {
    return {
      status: "error",
      error: mapAuthError(error, "register")
    };
  }

  return {
    status: data.session ? "redirect" : "email_confirmation"
  };
}

export type LoginResult =
  | { status: "success" }
  | { status: "configuration_error"; message: string }
  | { status: "error"; error: AuthApplicationError };

export async function loginAccount(input: LoginInput): Promise<LoginResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch (error) {
    const message = getSupabaseConfigurationMessage(error);
    if (message) {
      return { status: "configuration_error", message };
    }
    throw error;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password
  });

  if (error) {
    return {
      status: "error",
      error: mapAuthError(error, "login")
    };
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
  | { status: "configuration_error"; message: string }
  | { status: "error" };

export type OrganizationTypeOption = {
  code: string;
  displayName: string;
};

export async function getOrganizationTypeOptions(): Promise<OrganizationTypeOption[]> {
  const supabase = await createClient();
  const rows = await findActiveOrganizationTypes(supabase);

  return rows.flatMap((row) => {
    const code = row.code;
    const displayName = row.display_name;
    return typeof code === "string" && typeof displayName === "string" ? [{ code, displayName }] : [];
  });
}

export async function saveOnboardingProfile(input: OnboardingProfileInput): Promise<OnboardingResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch (error) {
    const message = getSupabaseConfigurationMessage(error);
    if (message) {
      return {
        status: "configuration_error",
        message
      };
    }
    throw error;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { status: "unauthorized" };
  }

  const { error } = await supabase.rpc("save_onboarding_profile", {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone ?? null
  });
  if (error) {
    return { status: "error" };
  }

  return { status: "success" };
}

export async function completeOnboarding(input: OnboardingAccountTypeInput): Promise<OnboardingResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch (error) {
    const message = getSupabaseConfigurationMessage(error);
    if (message) {
      return {
        status: "configuration_error",
        message
      };
    }
    throw error;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { status: "unauthorized" };
  }

  const { error } = await supabase.rpc("complete_account_onboarding", {
    p_account_type: input.accountType,
    p_organization_display_name: input.organizationDisplayName ?? null,
    p_organization_type_code: input.organizationTypeCode ?? null
  });

  if (error) {
    return { status: "error" };
  }

  return { status: "success" };
}
