import { describe, expect, it } from "vitest";

import { passwordSchema } from "../../features/auth/password-policy";
import { loginInputSchema, registerInputSchema } from "./auth";

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
      tipoUtente: "cliente",
      email: "person@example.test",
      password: "CorrectHorse12!",
      confirmPassword: "CorrectHorse12!",
      nome: "Arianna",
      cognome: "Rossi",
      codiceFiscale: "RSSRNN80A01H501Z",
      otpReference: "otp-reference",
      otpCode: "123456",
      acceptTerms: true,
      acceptPrivacy: true
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-matching passwords", () => {
    const result = registerInputSchema.safeParse({
      tipoUtente: "cliente",
      email: "person@example.test",
      password: "CorrectHorse12!",
      confirmPassword: "DifferentHorse1!",
      nome: "Arianna",
      cognome: "Rossi",
      codiceFiscale: "RSSRNN80A01H501Z",
      otpReference: "otp-reference",
      otpCode: "123456",
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
    expect(passwordSchema.safeParse("ValidPassword1!").success).toBe(true);
  });
});
