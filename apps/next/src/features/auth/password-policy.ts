import { z } from "zod";

export const passwordRequirements = [
  {
    id: "minLength",
    label: "Almeno 12 caratteri",
    message: "La password deve contenere almeno 12 caratteri.",
    test: (password: string) => password.length >= 12
  },
  {
    id: "uppercase",
    label: "Una lettera maiuscola",
    message: "La password deve contenere almeno una lettera maiuscola.",
    test: (password: string) => /[A-Z]/.test(password)
  },
  {
    id: "lowercase",
    label: "Una lettera minuscola",
    message: "La password deve contenere almeno una lettera minuscola.",
    test: (password: string) => /[a-z]/.test(password)
  },
  {
    id: "number",
    label: "Un numero",
    message: "La password deve contenere almeno un numero.",
    test: (password: string) => /[0-9]/.test(password)
  },
  {
    id: "specialCharacter",
    label: "Un carattere speciale",
    message: "La password deve contenere almeno un carattere speciale.",
    test: (password: string) => /[^A-Za-z0-9]/.test(password)
  }
] as const;

export type PasswordRequirement = (typeof passwordRequirements)[number];

export function isPasswordRequirementMet(requirement: PasswordRequirement, password: string): boolean {
  return requirement.test(password);
}

export const passwordSchema = z
  .string({ error: "Inserisci la password." })
  .max(72, "La password è troppo lunga.")
  .superRefine((password, context) => {
    for (const requirement of passwordRequirements) {
      if (!isPasswordRequirementMet(requirement, password)) {
        context.addIssue({ code: "custom", message: requirement.message });
      }
    }
  });
