import { z } from 'zod';

const uuid = z.string().uuid();

export const catalogCategorySchema = z.object({
  id: uuid,
  code: z.string().min(1),
  displayName: z.string().min(1),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
}).strict();

export const catalogProfessionalRequirementSchema = z.enum([
  'physician',
  'healthcare_professional',
  'beauty_professional',
]);

export const catalogTreatmentSchema = z.object({
  id: uuid,
  externalCode: z.string().min(1),
  name: z.string().min(1),
  categoryId: uuid,
  categoryCode: z.string().min(1),
  categoryDisplayName: z.string().min(1),
  description: z.string().nullable(),
  bodyArea: z.string().nullable(),
  defaultPoints: z.number().int().nonnegative(),
  defaultPriceCents: z.number().int().nonnegative(),
  defaultDurationMinMinutes: z.number().int().positive(),
  defaultDurationMaxMinutes: z.number().int().positive(),
  durationLabel: z.string().min(1),
  professionalRequirements: z.array(catalogProfessionalRequirementSchema),
  isActive: z.boolean(),
}).strict().refine(
  (value) => value.defaultDurationMaxMinutes >= value.defaultDurationMinMinutes,
  { message: 'Maximum duration must be greater than or equal to minimum duration' },
);

export const catalogCategoryListResponseSchema = z.object({
  items: z.array(catalogCategorySchema),
  total: z.number().int().nonnegative(),
}).strict();

export const catalogTreatmentListResponseSchema = z.object({
  items: z.array(catalogTreatmentSchema),
  total: z.number().int().nonnegative(),
}).strict();

export const catalogFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  categoryCode: z.string().trim().max(120).optional(),
  bodyArea: z.string().trim().max(120).optional(),
}).strict();

export const treatmentOfferingSchema = z.object({
  id: uuid,
  scope: z.enum(['organization', 'personal_professional']),
  organizationId: uuid.nullable(),
  professionalProfileId: uuid.nullable(),
  catalogTreatmentId: uuid,
  externalCode: z.string().min(1),
  name: z.string().min(1),
  categoryCode: z.string().min(1),
  categoryDisplayName: z.string().min(1),
  bodyArea: z.string().nullable(),
  defaultPriceCents: z.number().int().nonnegative(),
  defaultDurationMinMinutes: z.number().int().positive(),
  defaultDurationMaxMinutes: z.number().int().positive(),
  defaultPoints: z.number().int().nonnegative(),
  priceCents: z.number().int().nonnegative(),
  durationMinutes: z.number().int().positive(),
  points: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const treatmentOfferingListResponseSchema = z.object({
  items: z.array(treatmentOfferingSchema),
  total: z.number().int().nonnegative(),
}).strict();

export const createTreatmentOfferingRequestSchema = z.object({
  catalogTreatmentId: uuid,
  priceCents: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().positive().optional(),
  points: z.number().int().nonnegative().optional(),
}).strict();

export const updateTreatmentOfferingRequestSchema = z.object({
  priceCents: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().positive().optional(),
  points: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one offering field is required',
});

export const removeTreatmentOfferingResponseSchema = z.object({
  id: uuid,
  isActive: z.literal(false),
}).strict();

export type CatalogCategory = z.infer<typeof catalogCategorySchema>;
export type CatalogProfessionalRequirement = z.infer<typeof catalogProfessionalRequirementSchema>;
export type CatalogTreatment = z.infer<typeof catalogTreatmentSchema>;
export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;
export type TreatmentOffering = z.infer<typeof treatmentOfferingSchema>;
export type CreateTreatmentOfferingRequest = z.infer<typeof createTreatmentOfferingRequestSchema>;
export type UpdateTreatmentOfferingRequest = z.infer<typeof updateTreatmentOfferingRequestSchema>;
