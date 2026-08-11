import { z } from 'zod';
import { appRoleSchema } from './auth-schema';

export const loginPayloadSchema = z
  .object({
    email: z.string().email().optional(),
    codiceFiscale: z.string().optional(),
    password: z.string().min(1),
    userType: appRoleSchema.exclude(['admin']).optional(),
  })
  .refine((data) => data.email || data.codiceFiscale, {
    message: 'Either email or codiceFiscale is required',
  });

export type LoginPayload = z.infer<typeof loginPayloadSchema>;

export const loginResultSchema = z.object({
  token: z.string(),
  refreshToken: z.string().optional(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    tipo_utente: appRoleSchema,
    nome: z.string().nullable().optional(),
    cognome: z.string().nullable().optional(),
  }),
});

export type LoginResult = z.infer<typeof loginResultSchema>;
