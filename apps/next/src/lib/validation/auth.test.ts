import { describe, expect, it } from "vitest";

import { passwordSchema } from "../../features/auth/password-policy";
import { loginInputSchema, onboardingAccountTypeInputSchema, onboardingProfileInputSchema, registerInputSchema } from "./auth";

describe("login validation", () => {
  it("trims email and optional redirect without changing the password", () => {
    const result = loginInputSchema.safeParse({
      email: "  person@example.test  ",
      password: " password-with-space ",
      redirectTo: "  /select-context  "
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("person@example.test");
      expect(result.data.password).toBe(" password-with-space ");
      expect(result.data.redirectTo).toBe("/select-context");
    }
  });

  it("rejects a missing password and normalizes an empty redirect", () => {
    const result = loginInputSchema.safeParse({
      email: "person@example.test",
      password: "",
      redirectTo: "   "
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "password")).toBe(true);
    }
  });

  it("accepts a login form without the optional redirect", () => {
    const result = loginInputSchema.safeParse({
      email: "person@example.test",
      password: "correct-password",
      redirectTo: null
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.redirectTo).toBeUndefined();
    }
  });
});

describe("registration validation", () => {
  it("accepts valid credentials and consents", () => {
    const result = registerInputSchema.safeParse({
      email: "person@example.test",
      password: "CorrectHorse1!",
      confirmPassword: "CorrectHorse1!",
      acceptTerms: true,
      acceptPrivacy: true
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-matching passwords", () => {
    const result = registerInputSchema.safeParse({
      email: "person@example.test",
      password: "CorrectHorse1!",
      confirmPassword: "DifferentHorse1!",
      acceptTerms: true,
      acceptPrivacy: true
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "confirmPassword")).toBe(true);
    }
  });
});

describe("password policy", () => {
  it.each([
    ["password senza maiuscola", "validpass1!"],
    ["password senza minuscola", "VALIDPASS1!"],
    ["password senza numero", "ValidPass!"],
    ["password senza carattere speciale", "ValidPass1"],
    ["password troppo corta", "Aa1!"]
  ])("rifiuta una %s", (_description, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  it("accetta una password conforme a tutti i requisiti", () => {
    expect(passwordSchema.safeParse("ValidPass1!").success).toBe(true);
  });
});

describe("onboarding validation", () => {
  it("requires the minimum profile and normalizes personal data", () => {
    const result = onboardingProfileInputSchema.safeParse({
      firstName: "Arianna",
      lastName: "Rossi",
      phone: "  +39 333 1234567  "
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ firstName: "Arianna", lastName: "Rossi", phone: "+39 333 1234567" });
    }
  });

  it("rejects an invalid optional phone number", () => {
    expect(onboardingProfileInputSchema.safeParse({ firstName: "Arianna", lastName: "Rossi", phone: "not-a-phone" }).success).toBe(false);
  });

  it("requires organization details only for organization onboarding", () => {
    expect(onboardingAccountTypeInputSchema.safeParse({ accountType: "personal" }).success).toBe(true);
    expect(onboardingAccountTypeInputSchema.safeParse({ accountType: "organization" }).success).toBe(false);
    expect(
      onboardingAccountTypeInputSchema.safeParse({
        accountType: "organization",
        organizationDisplayName: "Studio BBW",
        organizationTypeCode: "independent_practice"
      }).success
    ).toBe(true);
  });
});
