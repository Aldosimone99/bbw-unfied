import { z } from "zod";

const phoneInputSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z
    .string()
    .max(30, "Il telefono è troppo lungo.")
    .refine(
      (value) => /^\+?[0-9][0-9 ()\.-]+$/.test(value) && (value.match(/[0-9]/g)?.length ?? 0) >= 7,
      "Inserisci un numero di telefono valido."
    )
    .optional()
);

export const personalDetailsInputSchema = z.object({
  firstName: z.string().trim().min(1, "Inserisci il nome.").max(80, "Il nome è troppo lungo."),
  lastName: z.string().trim().min(1, "Inserisci il cognome.").max(80, "Il cognome è troppo lungo."),
  phone: phoneInputSchema
});

export const profileUpdateInputSchema = z.object({
  ...personalDetailsInputSchema.shape
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;
export type PersonalDetailsInput = z.infer<typeof personalDetailsInputSchema>;
