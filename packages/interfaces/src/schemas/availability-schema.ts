import { z } from 'zod';

const uuid = z.string().uuid();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeString = z.string().regex(/^\d{2}:\d{2}$/);

export const upsertAvailabilityWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeString,
  endTime: timeString,
  isAvailable: z.boolean(),
}).strict();

export const createBlockedSlotSchema = z.object({
  date: dateString,
  startTime: timeString,
  endTime: timeString,
  reason: z.string().optional(),
}).strict();

export const bookingSettingsPayloadSchema = z.object({
  onlineBookingEnabled: z.boolean().optional(),
  firstSlot: z.enum(['domani', '3 giorni', '1 settimana']).optional(),
  lastSlot: z.enum(['4 settimane', '8 settimane', '12 settimane']).optional(),
  confermaPrenotazione: z.boolean().optional(),
  promemoriaVisita: z.boolean().optional(),
  confermaPresenza: z.boolean().optional(),
  richiestaRecensione: z.boolean().optional(),
  invitoProssimaVisita: z.boolean().optional(),
}).strict();

export const createRoomSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(1).optional(),
}).strict();

export const updateRoomSchema = createRoomSchema.partial().extend({
  isActive: z.boolean().optional(),
}).strict();

export const bookingAvailabilityRowSchema = z.object({
  id: uuid,
  professional_id: uuid,
  company_id: uuid.nullable(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  is_available: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const weeklyScheduleDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isAvailable: z.boolean(),
  windows: z.array(bookingAvailabilityRowSchema),
});

export const bookingBlockedSlotRowSchema = z.object({
  id: uuid,
  professional_id: uuid,
  company_id: uuid.nullable(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  reason: z.string().nullable(),
  created_at: z.string(),
});

export const bookingSettingsRowSchema = z.object({
  id: uuid.optional(),
  professional_id: uuid,
  online_booking_enabled: z.boolean(),
  first_slot: z.string(),
  last_slot: z.string(),
  conferma_prenotazione: z.boolean(),
  promemoria_visita: z.boolean(),
  conferma_presenza: z.boolean(),
  richiesta_recensione: z.boolean(),
  invito_prossima_visita: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const companyRoomRowSchema = z.object({
  id: uuid,
  company_id: uuid,
  name: z.string(),
  description: z.string().nullable(),
  capacity: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const availableSlotSchema = z.object({
  startTime: timeString,
  endTime: timeString,
});

export const publicProfileResponseSchema = z.object({
  id: uuid,
  nome: z.string(),
  cognome: z.string(),
  profile_slug: z.string(),
  tipo_utente: z.string(),
  specializzazioni: z.array(z.string()),
  bio: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  online_booking_enabled: z.boolean(),
});

export type UpsertAvailabilityWindowRequest = z.infer<typeof upsertAvailabilityWindowSchema>;
export type CreateBlockedSlotRequest = z.infer<typeof createBlockedSlotSchema>;
export type BookingSettingsPayload = z.infer<typeof bookingSettingsPayloadSchema>;
export type CreateRoomRequest = z.infer<typeof createRoomSchema>;
export type UpdateRoomRequest = z.infer<typeof updateRoomSchema>;
export type BookingAvailabilityRow = z.infer<typeof bookingAvailabilityRowSchema>;
export type WeeklyScheduleDay = z.infer<typeof weeklyScheduleDaySchema>;
export type BookingBlockedSlotRow = z.infer<typeof bookingBlockedSlotRowSchema>;
export type BookingSettingsRow = z.infer<typeof bookingSettingsRowSchema>;
export type CompanyRoomRow = z.infer<typeof companyRoomRowSchema>;
export type AvailableSlot = z.infer<typeof availableSlotSchema>;
export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;
