import { z } from 'zod';

const phoneSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined,
  z.string().max(50).optional(),
);

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return undefined;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : value;
  },
  z.string().max(255).optional(),
);

export const onboardingProfileRequestSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  cognome: z.string().trim().min(1).max(255),
  telefono: phoneSchema,
}).strict();

export const onboardingCompletionRequestSchema = z.object({
  account_type: z.enum([
    'personal',
    'healthcare_professional',
    'beauty_professional',
    'organization',
    'commercial',
  ]),
  organization_display_name: optionalTrimmedString,
}).superRefine((payload, context) => {
  if (payload.account_type === 'organization' && !payload.organization_display_name) {
    context.addIssue({ code: 'custom', path: ['organization_display_name'], message: 'organization_display_name is required' });
  }
});

export type OnboardingProfileRequest = z.infer<typeof onboardingProfileRequestSchema>;
export type OnboardingCompletionRequest = z.infer<typeof onboardingCompletionRequestSchema>;
import { appRoleSchema } from './auth-schema';

export const onboardingStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  complete: z.boolean(),
  blocking: z.boolean(),
}).strict();

export const onboardingStatusSchema = z.object({
  role: appRoleSchema,
  completed: z.boolean(),
  steps: z.array(onboardingStepSchema),
}).strict();

export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
export type OnboardingStatusStep = z.infer<typeof onboardingStepSchema>;
