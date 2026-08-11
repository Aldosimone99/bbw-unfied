import { z } from 'zod';

const uuid = z.string().uuid();

export const createAssignmentRequestSchema = z.object({
  platformTreatmentId: uuid.optional(),
  companyCatalogId: uuid.optional(),
  priceOverrideCents: z.number().int().min(0).optional(),
  durationOverrideMin: z.number().int().min(1).optional(),
  pointsOverride: z.number().int().min(0).optional(),
  consentTemplateId: uuid.optional(),
  isPublic: z.boolean().optional(),
}).refine((data) => {
  const hasPlatform = Boolean(data.platformTreatmentId);
  const hasCompany = Boolean(data.companyCatalogId);
  return (hasPlatform && !hasCompany) || (!hasPlatform && hasCompany);
}, { message: 'Exactly one of platformTreatmentId or companyCatalogId is required' });

export const updateAssignmentRequestSchema = z.object({
  priceOverrideCents: z.number().int().min(0).optional(),
  durationOverrideMin: z.number().int().min(1).optional(),
  pointsOverride: z.number().int().min(0).optional(),
  consentTemplateId: uuid.optional(),
  isPublic: z.boolean().optional(),
});

export const adoptTreatmentRequestSchema = z.object({
  platformTreatmentId: uuid,
  priceOverrideCents: z.number().int().min(0).optional(),
  durationOverrideMin: z.number().int().min(1).optional(),
  pointsOverride: z.number().int().min(0).optional(),
  consentTemplateId: uuid.optional(),
});

export const createCustomServiceRequestSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  descriptionMale: z.string().optional(),
  descriptionFemale: z.string().optional(),
  category: z.string().optional(),
  duration: z.number().int().min(1).refine((val) => val % 30 === 0, { message: 'Duration must be a multiple of 30 minutes' }),
  priceCents: z.number().int().min(0),
  points: z.number().int().min(0).optional(),
  insuranceIncluded: z.boolean().optional(),
  location: z.string().optional(),
  consentTemplateId: uuid.optional(),
});

export const platformTreatmentSchema = z.object({
  id: uuid,
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  allowed_roles: z.array(z.string()).nullable().optional(),
  insurance_included: z.boolean().optional(),
  description: z.string().nullable().optional(),
  description_male: z.string().nullable().optional(),
  description_female: z.string().nullable().optional(),
  image_male_path: z.string().nullable().optional(),
  image_female_path: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  duration: z.number().int(),
  price_cents: z.number().int(),
  points: z.number().int().optional(),
  is_active: z.boolean().optional(),
  automatic_consents_active: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const catalogAssignmentSchema = z.object({
  assignment_id: uuid,
  professional_id: uuid,
  platform_treatment_id: uuid.nullable().optional(),
  slug: z.string().optional(),
  name: z.string(),
  category: z.string(),
  allowed_roles: z.array(z.string()).nullable().optional(),
  insurance_included: z.boolean().optional(),
  effective_price_cents: z.number().int(),
  effective_duration_min: z.number().int(),
  effective_points: z.number().int(),
  effective_consent_template_id: uuid.nullable().optional(),
  company_catalog_id: uuid.nullable().optional(),
  disclaimer_accepted: z.boolean(),
  is_active: z.boolean(),
  is_public: z.boolean(),
});

export const customServiceSchema = z.object({
  id: uuid,
  professional_id: uuid.nullable().optional(),
  company_id: uuid.nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  description_male: z.string().nullable().optional(),
  description_female: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  duration: z.number().int(),
  price_cents: z.number().int(),
  points: z.number().int().optional(),
  insurance_included: z.boolean().optional(),
  location: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const companyCatalogItemSchema = z.object({
  id: uuid,
  company_id: uuid,
  platform_treatment_id: uuid,
  name: z.string(),
  category: z.string(),
  effective_price_cents: z.number(),
  effective_duration_min: z.number(),
  effective_points: z.number(),
  consent_template_id: uuid.nullable().optional(),
  is_active: z.boolean(),
});

export type CreateAssignmentRequest = z.infer<typeof createAssignmentRequestSchema>;
export type UpdateAssignmentRequest = z.infer<typeof updateAssignmentRequestSchema>;
export type AdoptTreatmentRequest = z.infer<typeof adoptTreatmentRequestSchema>;
export type CreateCustomServiceRequest = z.infer<typeof createCustomServiceRequestSchema>;
export type PlatformTreatment = z.infer<typeof platformTreatmentSchema>;
export type CatalogAssignment = z.infer<typeof catalogAssignmentSchema>;
export type CustomService = z.infer<typeof customServiceSchema>;
export type CompanyCatalogItem = z.infer<typeof companyCatalogItemSchema>;
