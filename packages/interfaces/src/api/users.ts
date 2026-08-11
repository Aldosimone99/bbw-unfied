import { z } from 'zod';
import { appRoleSchema } from '../schemas/auth-schema';

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  tipo_utente: appRoleSchema,
  nome: z.string().nullable().optional(),
  cognome: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
