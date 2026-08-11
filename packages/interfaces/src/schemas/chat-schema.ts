import { z } from 'zod';
import { messageRowSchema } from './notification-schema';

export const sendMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(4000),
}).strict();

export const startThreadRequestSchema = z.object({
  recipientId: z.string().uuid(),
}).strict();

export const chatContactSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().nullable().optional(),
  cognome: z.string().nullable().optional(),
  tipo_utente: z.string(),
  avatar_url: z.string().nullable().optional(),
});

export const chatThreadSchema = z.object({
  id: z.string().uuid(),
  participant_ids: z.array(z.string().uuid()),
  other_participant: chatContactSchema,
  last_message: messageRowSchema.nullable().optional(),
  unread_count: z.number(),
  updated_at: z.string(),
});

export const chatThreadListResponseSchema = z.object({
  data: z.array(chatThreadSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;
export type StartThreadRequest = z.infer<typeof startThreadRequestSchema>;
export type ChatContact = z.infer<typeof chatContactSchema>;
export type ChatThread = z.infer<typeof chatThreadSchema>;
export type ChatThreadListResponse = z.infer<typeof chatThreadListResponseSchema>;
