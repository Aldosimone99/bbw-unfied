import { z } from 'zod';

const uuid = z.string().uuid();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeString = z.string().regex(/^\d{2}:\d{2}$/);

export const createBookingRequestSchema = z.object({
  professionalId: uuid,
  companyId: uuid.optional(),
  serviceId: uuid.optional(),
  serviceName: z.string().trim().min(1),
  date: dateString,
  startTime: timeString,
  endTime: timeString,
  duration: z.number().int().min(30).multipleOf(30),
  notes: z.string().optional(),
  priceCents: z.number().int().min(0).optional(),
}).strict();

export const createAdminBookingSchema = createBookingRequestSchema.extend({
  patientId: uuid,
  roomId: uuid.optional(),
}).strict();

export const bookingStatusSchema = z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']);

export const bookingRowSchema = z.object({
  id: uuid,
  professional_id: uuid.nullable(),
  patient_id: uuid.nullable(),
  company_id: uuid.nullable(),
  room_id: uuid.nullable(),
  service_id: uuid.nullable(),
  service_name: z.string().nullable(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  duration: z.number(),
  status: bookingStatusSchema,
  notes: z.string().nullable(),
  price_cents: z.number().nullable(),
  points: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const bookingListResponseSchema = z.object({
  data: z.array(bookingRowSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});

export const createPPLInviteSchema = z.object({
  companyId: uuid.optional(),
  email: z.string().email(),
  nome: z.string().trim().optional(),
  cognome: z.string().trim().optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
}).strict();

export const pplInviteStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);

export const pplInviteRowSchema = z.object({
  id: uuid,
  professional_id: uuid,
  company_id: uuid.nullable(),
  patient_id: uuid.nullable(),
  email: z.string().email(),
  nome: z.string().nullable(),
  cognome: z.string().nullable(),
  status: pplInviteStatusSchema,
  expires_at: z.string().nullable(),
  accepted_at: z.string().nullable(),
  created_at: z.string(),
});

export const pplInviteListResponseSchema = z.object({
  data: z.array(pplInviteRowSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});

export const pplInviteLookupResponseSchema = z.object({
  id: uuid,
  email: z.string().email(),
  nome: z.string().nullable(),
  cognome: z.string().nullable(),
  professionalId: uuid,
  professionalName: z.string(),
  clinicName: z.string().nullable(),
  expiresAt: z.string().nullable(),
  status: z.enum(['pending', 'accepted']),
});

export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>;
export type CreateAdminBookingRequest = z.infer<typeof createAdminBookingSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type BookingRow = z.infer<typeof bookingRowSchema>;
export type BookingListResponse = z.infer<typeof bookingListResponseSchema>;
export type CreatePPLInviteRequest = z.infer<typeof createPPLInviteSchema>;
export type PPLInviteRow = z.infer<typeof pplInviteRowSchema>;
export type PPLInviteListResponse = z.infer<typeof pplInviteListResponseSchema>;
export type PPLInviteLookupResponse = z.infer<typeof pplInviteLookupResponseSchema>;
