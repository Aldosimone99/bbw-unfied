import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const patientRelationshipScopeSchema = z.enum(['organization', 'personal_professional']);
export const patientRelationshipOriginKindSchema = z.enum(['organization', 'professional']);
export const patientRelationshipStatusSchema = z.enum(['active', 'removed']);

export const patientRelationshipSchema = z.object({
  relationshipId: uuidSchema,
  subjectId: uuidSchema,
  relationshipScope: patientRelationshipScopeSchema,
  organizationId: uuidSchema.nullable(),
  professionalProfileId: uuidSchema.nullable(),
  originKind: patientRelationshipOriginKindSchema,
  originOrganizationId: uuidSchema.nullable(),
  originProfessionalProfileId: uuidSchema.nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email(),
  phone: z.string().nullable(),
  birthDate: z.string().nullable(),
  status: patientRelationshipStatusSchema,
  linkedAt: z.string(),
  removedAt: z.string().nullable(),
}).strict();

export const patientRelationshipListSchema = z.object({
  relationshipScope: patientRelationshipScopeSchema,
  items: z.array(patientRelationshipSchema),
  total: z.number().int().nonnegative(),
}).strict();

export const patientLookupRequestSchema = z.object({
  email: z.string().trim().email().optional(),
  taxCode: z.string().trim().min(1).max(64).optional(),
}).strict().superRefine((value, context) => {
  const supplied = [value.email, value.taxCode].filter((entry) => Boolean(entry));
  if (supplied.length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one exact patient identifier',
      path: ['email'],
    });
  }
});

export const patientLookupResponseSchema = z.object({
  subjectId: uuidSchema,
  userId: uuidSchema,
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
}).strict();

export const createPatientRelationshipRequestSchema = z.object({
  subjectId: uuidSchema,
}).strict();

export const removePatientRelationshipResponseSchema = z.object({
  relationshipId: uuidSchema,
  status: z.literal('removed'),
}).strict();

export type PatientRelationship = z.infer<typeof patientRelationshipSchema>;
export type PatientRelationshipOriginKind = z.infer<typeof patientRelationshipOriginKindSchema>;
export type PatientRelationshipList = z.infer<typeof patientRelationshipListSchema>;
export type PatientLookupRequest = z.infer<typeof patientLookupRequestSchema>;
export type PatientLookupResponse = z.infer<typeof patientLookupResponseSchema>;
export type CreatePatientRelationshipRequest = z.infer<typeof createPatientRelationshipRequestSchema>;
export type RemovePatientRelationshipResponse = z.infer<typeof removePatientRelationshipResponseSchema>;
