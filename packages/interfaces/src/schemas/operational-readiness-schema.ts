import { z } from 'zod';

const requiredTrimmedString = (maximum: number) => z.string().trim().min(1).max(maximum);
const nullableOptionalTrimmedString = (maximum: number) => requiredTrimmedString(maximum).nullable().optional();

export const addressInputSchema = z.object({
  street: requiredTrimmedString(255),
  city: requiredTrimmedString(255),
  postal_code: requiredTrimmedString(16),
  country_code: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  province: z.string().trim().max(32).nullable().optional(),
  locality: z.string().trim().max(255).nullable().optional(),
}).strict();

export const personalProfileUpdateRequestSchema = z.object({
  first_name: nullableOptionalTrimmedString(255),
  last_name: nullableOptionalTrimmedString(255),
  phone: nullableOptionalTrimmedString(50),
  birth_date: z.iso.date().nullable().optional(),
  tax_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{16}$/).nullable().optional(),
  address: addressInputSchema.nullable().optional(),
}).strict().refine((payload) => Object.values(payload).some((value) => value !== undefined), {
  message: 'At least one profile field must be provided',
});

export const organizationProfileUpdateRequestSchema = z.object({
  legal_name: nullableOptionalTrimmedString(255),
  display_name: requiredTrimmedString(255).optional(),
  tax_identifier: nullableOptionalTrimmedString(32),
  email: z.string().trim().email().max(255).nullable().optional(),
  phone: nullableOptionalTrimmedString(50),
  address: addressInputSchema.nullable().optional(),
}).strict().refine((payload) => Object.values(payload).some((value) => value !== undefined), {
  message: 'At least one organization field must be provided',
});

export const organizationIdParamSchema = z.object({
  organization_id: z.string().uuid(),
}).strict();

export const readinessContextQuerySchema = z.object({
  organization_id: z.string().uuid().optional(),
}).strict();

export const personalProfileMissingFieldSchema = z.enum([
  'first_name',
  'last_name',
  'birth_date',
  'tax_code',
  'address',
]);

export const organizationProfileMissingFieldSchema = z.enum([
  'legal_name',
  'display_name',
  'organization_type',
  'tax_identifier',
  'email',
  'phone',
  'address',
  'owner',
]);

export const professionalVerificationStatusSchema = z.enum([
  'draft',
  'pending',
  'verified',
  'rejected',
  'suspended',
]);

export const professionalReadinessBlockerSchema = z.enum([
  'professional_profile_missing',
  'professional_verification_required',
  'professional_verification_pending',
  'professional_verification_rejected',
  'professional_verification_suspended',
]);

export const personalProfileReadinessSchema = z.object({
  complete: z.boolean(),
  missing_fields: z.array(personalProfileMissingFieldSchema),
}).strict();

export const organizationReadinessSchema = z.object({
  applicable: z.boolean(),
  complete: z.boolean(),
  missing_fields: z.array(organizationProfileMissingFieldSchema),
}).strict();

export const professionalProfileReadinessItemSchema = z.object({
  professional_type_code: z.string(),
  profile_complete: z.boolean(),
  verification_required: z.boolean(),
  verification_status: professionalVerificationStatusSchema,
  operational: z.boolean(),
  blockers: z.array(professionalReadinessBlockerSchema),
}).strict();

export const professionalReadinessSchema = z.object({
  applicable: z.boolean(),
  profile_complete: z.boolean(),
  verification_status: professionalVerificationStatusSchema.nullable(),
  operational: z.boolean(),
  blockers: z.array(professionalReadinessBlockerSchema),
  profiles: z.array(professionalProfileReadinessItemSchema),
}).strict();

export const operationalReadinessSchema = z.object({
  personal_profile: personalProfileReadinessSchema,
  organization: organizationReadinessSchema,
  professional: professionalReadinessSchema,
}).strict();

export const operationalRequirementSchema = z.object({
  personal_profile_complete: z.boolean().optional(),
  organization_profile_complete: z.boolean().optional(),
  professional_profile_complete: z.boolean().optional(),
  professional_verified: z.boolean().optional(),
}).strict();

export const operationalReadinessErrorCodeSchema = z.enum([
  'PERSONAL_PROFILE_INCOMPLETE',
  'ORGANIZATION_PROFILE_INCOMPLETE',
  'ORGANIZATION_CONTEXT_REQUIRED',
  'PROFESSIONAL_PROFILE_INCOMPLETE',
  'PROFESSIONAL_NOT_VERIFIED',
]);

export const operationalReadinessErrorSchema = z.object({
  error: z.object({
    code: operationalReadinessErrorCodeSchema,
    missing_fields: z.array(z.string()).optional(),
    blockers: z.array(z.string()).optional(),
  }).strict(),
}).strict();

export type AddressInput = z.infer<typeof addressInputSchema>;
export type PersonalProfileUpdateRequest = z.infer<typeof personalProfileUpdateRequestSchema>;
export type OrganizationProfileUpdateRequest = z.infer<typeof organizationProfileUpdateRequestSchema>;
export type PersonalProfileReadiness = z.infer<typeof personalProfileReadinessSchema>;
export type OrganizationReadiness = z.infer<typeof organizationReadinessSchema>;
export type ProfessionalReadiness = z.infer<typeof professionalReadinessSchema>;
export type OperationalReadiness = z.infer<typeof operationalReadinessSchema>;
export type OperationalRequirement = z.infer<typeof operationalRequirementSchema>;
export type OperationalReadinessErrorCode = z.infer<typeof operationalReadinessErrorCodeSchema>;
