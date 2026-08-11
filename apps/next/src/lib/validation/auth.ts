import { z } from "zod";

import { passwordSchema } from "../../features/auth/password-policy";

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
    tipoUtente: z.enum(["cliente", "medico", "estetista", "commerciale", "clinica"], { error: "Scegli il tipo di account." }),
    email: z.string().trim().email("Inserisci un indirizzo email valido."),
    password: passwordSchema,
    confirmPassword: z.string({ error: "Conferma la password." }).min(1, "Conferma la password."),
    nome: z.string().trim().max(255).optional(),
    cognome: z.string().trim().max(255).optional(),
    codiceFiscale: z.string().trim().toUpperCase().optional(),
    ragioneSociale: z.string().trim().max(255).optional(),
    partitaIva: z.string().trim().max(20).optional(),
    studioCitta: z.string().trim().max(255).optional(),
    numeroAlbo: z.string().trim().max(100).optional(),
    otpReference: z.string().trim().optional(),
    otpCode: z.string().trim().optional(),
    acceptTerms: z.literal(true, { error: "Devi accettare i termini e condizioni." }),
    acceptPrivacy: z.literal(true, { error: "Devi accettare l’informativa privacy." })
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Le password non coincidono."
  })
  .superRefine((input, context) => {
    if (input.tipoUtente !== "clinica") {
      if (!input.nome) context.addIssue({ code: "custom", path: ["nome"], message: "Inserisci il nome." });
      if (!input.cognome) context.addIssue({ code: "custom", path: ["cognome"], message: "Inserisci il cognome." });
      if (!input.codiceFiscale || input.codiceFiscale.length !== 16) {
        context.addIssue({ code: "custom", path: ["codiceFiscale"], message: "Inserisci un codice fiscale valido." });
      }
    }

    if (["commerciale", "clinica"].includes(input.tipoUtente)) {
      if (!input.ragioneSociale) context.addIssue({ code: "custom", path: ["ragioneSociale"], message: "Inserisci la ragione sociale." });
      if (!input.partitaIva) context.addIssue({ code: "custom", path: ["partitaIva"], message: "Inserisci la partita IVA." });
    }

    if (["medico", "estetista"].includes(input.tipoUtente) && !input.studioCitta) {
      context.addIssue({ code: "custom", path: ["studioCitta"], message: "Inserisci la città dello studio." });
    }

    if (input.tipoUtente === "medico" && !input.numeroAlbo) {
      context.addIssue({ code: "custom", path: ["numeroAlbo"], message: "Inserisci il numero di albo." });
    }

    if (!input.otpReference) context.addIssue({ code: "custom", path: ["otpReference"], message: "Invia e verifica il codice email." });
    if (!input.otpCode) context.addIssue({ code: "custom", path: ["otpCode"], message: "Inserisci il codice email." });
  });

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
