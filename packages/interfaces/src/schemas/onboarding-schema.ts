import { z } from 'zod';
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
