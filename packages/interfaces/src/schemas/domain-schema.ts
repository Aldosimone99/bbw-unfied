import { z } from 'zod';

const professionalTypeCodeSchema = z.string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/);

export const professionalProfileCreateSchema = z.object({
  professional_type_code: professionalTypeCodeSchema,
  display_name: z.string().trim().max(255).optional(),
  bio: z.string().trim().max(4000).optional(),
}).strict();

export const professionalProfileUpdateSchema = z.object({
  display_name: z.string().trim().max(255).nullable().optional(),
  bio: z.string().trim().max(4000).nullable().optional(),
}).strict();

export type ProfessionalProfileCreateRequest = z.infer<typeof professionalProfileCreateSchema>;
export type ProfessionalProfileUpdateRequest = z.infer<typeof professionalProfileUpdateSchema>;
