import { z } from 'zod';
import { OTP_PURPOSES } from '../enums/otp-purpose';

export const sendOtpPayloadSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(OTP_PURPOSES),
});

export const verifyOtpPayloadSchema = z
  .object({
    code: z.string().length(6),
    reference: z.string().uuid().optional(),
    email: z.string().email().optional(),
    purpose: z.enum(OTP_PURPOSES),
  })
  .refine((data) => data.reference || data.email, {
    message: 'Either reference or email is required',
  });

export const resendOtpPayloadSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(OTP_PURPOSES),
});

export type SendOtpPayload = z.infer<typeof sendOtpPayloadSchema>;
export type VerifyOtpPayload = z.infer<typeof verifyOtpPayloadSchema>;
export type ResendOtpPayload = z.infer<typeof resendOtpPayloadSchema>;
