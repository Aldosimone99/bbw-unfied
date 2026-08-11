import { z } from 'zod';

const passwordStrength = z
  .string()
  .min(12, 'PASSWORD_TOO_SHORT')
  .regex(/[A-Z]/, 'PASSWORD_MISSING_UPPERCASE')
  .regex(/[a-z]/, 'PASSWORD_MISSING_LOWERCASE')
  .regex(/[0-9]/, 'PASSWORD_MISSING_DIGIT')
  .regex(/[^A-Za-z0-9]/, 'PASSWORD_MISSING_SYMBOL');

export const forgotPasswordPayloadSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordPayloadSchema = z.object({
  newPassword: passwordStrength,
  tokenHash: z.string().optional(),
});

export const verifyPasswordPayloadSchema = z.object({
  password: z.string().min(1),
});

export type ForgotPasswordPayload = z.infer<typeof forgotPasswordPayloadSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordPayloadSchema>;
export type VerifyPasswordPayload = z.infer<typeof verifyPasswordPayloadSchema>;
