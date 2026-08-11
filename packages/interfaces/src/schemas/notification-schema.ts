import { z } from 'zod';

export const systemMessageContextSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('company_invite'),
    inviteId: z.string().uuid(),
    clinicName: z.string(),
    role: z.string(),
    token: z.string(),
  }),
  z.object({
    type: z.literal('invite_accepted'),
    inviteId: z.string().uuid(),
    clinicName: z.string(),
    acceptedByName: z.string(),
  }),
  z.object({
    type: z.literal('appointment_created'),
    appointmentId: z.string().uuid(),
    date: z.string(),
    professionalName: z.string(),
  }),
  z.object({
    type: z.literal('appointment_cancelled'),
    appointmentId: z.string().uuid(),
    date: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('ppl_invite_received'),
    inviteId: z.string().uuid(),
    professionalName: z.string(),
    clinicName: z.string().optional(),
  }),
  z.object({
    type: z.literal('ppl_invite_accepted'),
    inviteId: z.string().uuid(),
    patientName: z.string(),
  }),
  z.object({
    type: z.literal('appointment_confirmed'),
    appointmentId: z.string().uuid(),
    date: z.string(),
    professionalName: z.string(),
  }),
  z.object({
    type: z.literal('consent_awaiting_signature'),
    consentId: z.string().uuid(),
    patientName: z.string(),
    treatmentName: z.string(),
  }),
  z.object({
    type: z.literal('consent_awaiting_clinic_signature'),
    consentId: z.string().uuid(),
    professionalName: z.string(),
  }),
  z.object({
    type: z.literal('consent_awaiting_client_signature'),
    consentId: z.string().uuid(),
    professionalName: z.string(),
    shareLink: z.string(),
  }),
  z.object({
    type: z.literal('consent_fully_signed'),
    consentId: z.string().uuid(),
    patientName: z.string(),
  }),
  z.object({
    type: z.literal('consent_revoked'),
    consentId: z.string().uuid(),
    reason: z.string(),
  }),
]);

export const messageRowSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  type: z.enum(['text', 'image', 'file', 'system']),
  content: z.string().nullable().optional(),
  context: systemMessageContextSchema.nullable().optional(),
  read_by: z.array(z.string().uuid()).nullable().optional(),
  created_at: z.string(),
});

export const notificationThreadSchema = z.object({
  id: z.string().uuid(),
  participant_ids: z.array(z.string().uuid()),
  last_message: messageRowSchema.nullable().optional(),
  unread_count: z.number(),
  updated_at: z.string(),
});

export const notificationThreadListResponseSchema = z.object({
  data: z.array(notificationThreadSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});

export const threadMessagesResponseSchema = z.object({
  data: z.array(messageRowSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});

export type SystemMessageContext = z.infer<typeof systemMessageContextSchema>;
export type MessageRow = z.infer<typeof messageRowSchema>;
export type NotificationThread = z.infer<typeof notificationThreadSchema>;
export type NotificationThreadListResponse = z.infer<typeof notificationThreadListResponseSchema>;
export type ThreadMessagesResponse = z.infer<typeof threadMessagesResponseSchema>;
