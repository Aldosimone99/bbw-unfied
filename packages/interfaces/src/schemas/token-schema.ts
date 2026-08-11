import { z } from 'zod';
import { OTP_PURPOSES } from '../enums/otp-purpose';

export const sensitiveTokenPayloadSchema = z.object({
  verificationToken: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export const consentOtpPayloadSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(OTP_PURPOSES),
});

export type SensitiveTokenPayload = z.infer<typeof sensitiveTokenPayloadSchema>;
export type ConsentOtpPayload = z.infer<typeof consentOtpPayloadSchema>;
