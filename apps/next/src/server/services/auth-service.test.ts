import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../../lib/supabase/server";
import { completeOnboarding, loginAccount, registerAccount, saveOnboardingProfile } from "./auth-service";

vi.mock("../../lib/supabase/server", () => ({
  createClient: vi.fn()
}));

const mockedCreateClient = vi.mocked(createClient);
const signUp = vi.fn();
const signInWithPassword = vi.fn();
const getUser = vi.fn();
const rpc = vi.fn();
const update = vi.fn();
const eq = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  mockedCreateClient.mockResolvedValue({
    auth: { signUp, signInWithPassword, getUser },
    rpc,
    from: vi.fn(() => ({ update }))
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  update.mockReturnValue({ eq });
  eq.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
});

describe("registerAccount", () => {
  it("returns a specific message when the email is already registered", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "user_already_exists", message: "User already registered" }
    });

    const result = await registerAccount(
      {
        email: "person@example.test",
        password: "CorrectHorse1!",
        confirmPassword: "CorrectHorse1!",
        acceptTerms: true,
        acceptPrivacy: true
      },
      "http://localhost:3000/auth/callback"
    );

    expect(result).toEqual({
      status: "error",
      error: {
        kind: "email_already_registered",
        message: "Esiste già un account associato a questa email"
      }
    });
  });

  it("keeps login errors generic for invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 }
    });

    const result = await loginAccount({
      email: "person@example.test",
      password: "wrong-password"
    });

    expect(result).toEqual({
      status: "error",
      error: {
        kind: "invalid_credentials",
        message: "Email o password non corrette."
      }
    });
  });
});

describe("onboarding services", () => {
  it("saves personal data through the onboarding RPC", async () => {
    rpc.mockResolvedValue({ error: null });

    await expect(saveOnboardingProfile({ firstName: "Arianna", lastName: "Rossi", phone: undefined })).resolves.toEqual({ status: "success" });
    expect(rpc).toHaveBeenCalledWith("save_onboarding_profile", {
      p_first_name: "Arianna",
      p_last_name: "Rossi",
      p_phone: null
    });
  });

  it("completes organization onboarding through the atomic RPC", async () => {
    rpc.mockResolvedValue({ error: null });

    await expect(
      completeOnboarding({
        accountType: "organization",
        organizationDisplayName: "Studio BBW",
        organizationTypeCode: "independent_practice"
      })
    ).resolves.toEqual({ status: "success" });

    expect(rpc).toHaveBeenCalledWith("complete_account_onboarding", {
      p_account_type: "organization",
      p_organization_display_name: "Studio BBW",
      p_organization_type_code: "independent_practice"
    });
  });
});
