import { z } from 'zod';

export const operationalContextKindSchema = z.enum([
  'personal_professional',
  'organization',
]);

export const operationalContextReferenceSchema = z.object({
  kind: operationalContextKindSchema,
  id: z.string().uuid(),
}).strict();

export const operationalContextRoleSchema = z.object({
  code: z.string().min(1),
  displayName: z.string().min(1),
}).strict();

export const personalProfessionalOperationalContextSchema = z.object({
  kind: z.literal('personal_professional'),
  professionalProfileId: z.string().uuid(),
  label: z.string().min(1),
  professionalTypeCode: z.string().min(1),
  professionalTypeDisplayName: z.string().min(1),
}).strict();

export const organizationOperationalContextSchema = z.object({
  kind: z.literal('organization'),
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
  label: z.string().min(1),
  organizationTypeCode: z.string().min(1).nullable(),
  organizationTypeDisplayName: z.string().min(1).nullable(),
  roles: z.array(operationalContextRoleSchema),
}).strict();

export const operationalContextSchema = z.discriminatedUnion('kind', [
  personalProfessionalOperationalContextSchema,
  organizationOperationalContextSchema,
]);

export const operationalContextQuerySchema = z.object({
  context_kind: operationalContextKindSchema.optional(),
  context_id: z.string().uuid().optional(),
}).strict().superRefine((query, context) => {
  if ((query.context_kind === undefined) !== (query.context_id === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'context_kind and context_id must be supplied together',
      path: query.context_kind === undefined ? ['context_kind'] : ['context_id'],
    });
  }
});

export type OperationalContextKind = z.infer<typeof operationalContextKindSchema>;
export type OperationalContextReference = z.infer<typeof operationalContextReferenceSchema>;
export type OperationalContextRole = z.infer<typeof operationalContextRoleSchema>;
export type PersonalProfessionalOperationalContext = z.infer<typeof personalProfessionalOperationalContextSchema>;
export type OrganizationOperationalContext = z.infer<typeof organizationOperationalContextSchema>;
export type OperationalContext = z.infer<typeof operationalContextSchema>;
