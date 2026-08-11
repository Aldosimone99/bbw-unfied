import { z } from "zod";

import { passwordSchema } from "../../features/auth/password-policy";
import { accountTypeCodes } from "../../types/authorization";
import { personalDetailsInputSchema } from "./profile";

export const loginInputSchema = z.object({
  email: z.string().trim().email("Inserisci un indirizzo email valido."),
  password: z.string().min(1, "Inserisci la password."),
  redirectTo: z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().optional()
  )
});

export const registerInputSchema = z
  .object({
    email: z.string().trim().email("Inserisci un indirizzo email valido."),
    password: passwordSchema,
    confirmPassword: z.string({ error: "Conferma la password." }).min(1, "Conferma la password."),
    acceptTerms: z.literal(true, { error: "Devi accettare i termini e condizioni." }),
    acceptPrivacy: z.literal(true, { error: "Devi accettare l'informativa privacy." })
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Le password non coincidono."
  });

export const onboardingProfileInputSchema = personalDetailsInputSchema;

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(max).optional()
  );

export const onboardingAccountTypeInputSchema = z
  .object({
    accountType: z.enum(accountTypeCodes, { error: "Scegli il tipo di esperienza." }),
    organizationDisplayName: optionalTrimmedString(160),
    organizationTypeCode: optionalTrimmedString(80)
  })
  .superRefine((input, context) => {
    if (input.accountType !== "organization") return;

    if (!input.organizationDisplayName) {
      context.addIssue({ code: "custom", path: ["organizationDisplayName"], message: "Inserisci il nome dell’organizzazione." });
    }

    if (!input.organizationTypeCode) {
      context.addIssue({ code: "custom", path: ["organizationTypeCode"], message: "Scegli il tipo di organizzazione." });
    }
  });

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type OnboardingProfileInput = z.infer<typeof onboardingProfileInputSchema>;
export type OnboardingAccountTypeInput = z.infer<typeof onboardingAccountTypeInputSchema>;
