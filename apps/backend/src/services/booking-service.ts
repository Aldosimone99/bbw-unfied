import type { SupabaseLike } from '../db/supabase';
import {
  getOrCreateNotificationThread,
  insertSystemMessage,
} from './messaging-service';
import { setPPLStatus } from './ppl-service';
import { assertSlotAvailable } from './slots-service';
import { createForTreatment } from './consent-document-service';

export class BookingError extends Error {
  constructor(public code: string, public statusCode: number, message = code) {
    super(message);
  }
}

export type BookingRow = {
  id: string;
  professional_id: string | null;
  patient_id: string | null;
  company_id: string | null;
  room_id: string | null;
  service_id: string | null;
  service_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes: string | null;
  price_cents: number | null;
  points: number | null;
  created_at: string;
  updated_at: string;
};

type BookingPayload = {
  patientId: string;
  professionalId: string;
  companyId?: string;
  serviceId?: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  roomId?: string;
  notes?: string;
  priceCents?: number;
};

type PaginatedResult<T> = { data: T[]; total: number; page: number; limit: number; pages: number };

type MessagingServiceLike = {
  getOrCreateNotificationThread: typeof getOrCreateNotificationThread;
  insertSystemMessage: typeof insertSystemMessage;
};

const defaultMessagingService: MessagingServiceLike = {
  getOrCreateNotificationThread,
  insertSystemMessage,
};

async function insertBooking(db: SupabaseLike, payload: BookingPayload, status: BookingRow['status']): Promise<BookingRow> {
  const now = new Date().toISOString();
  const { data, error } = await db.from('bookings').insert({
    professional_id: payload.professionalId,
    patient_id: payload.patientId,
    company_id: payload.companyId ?? null,
    room_id: payload.roomId ?? null,
    service_id: payload.serviceId ?? null,
    service_name: payload.serviceName,
    date: payload.date,
    start_time: payload.startTime,
    end_time: payload.endTime,
    duration: payload.duration,
    status,
    notes: payload.notes ?? null,
    price_cents: payload.priceCents ?? null,
    updated_at: now,
  }).select('*').single();
  if (error || !data) throw new BookingError('BOOKING_CREATE_FAILED', 500);
  return data as BookingRow;
}

async function getBookingRow(db: SupabaseLike, bookingId: string): Promise<BookingRow> {
  const { data } = await db.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!data) throw new BookingError('BOOKING_NOT_FOUND', 404);
  return data as BookingRow;
}

async function updateBookingStatus(db: SupabaseLike, bookingId: string, status: BookingRow['status']): Promise<BookingRow> {
  const { data, error } = await db
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select('*')
    .single();
  if (error || !data) throw new BookingError('BOOKING_UPDATE_FAILED', 500);
  return data as BookingRow;
}

async function notify(
  db: SupabaseLike,
  messaging: MessagingServiceLike,
  participants: string[],
  senderId: string,
  type: 'appointment_created' | 'appointment_confirmed' | 'appointment_cancelled',
  context: Record<string, unknown>,
) {
  const threadId = await messaging.getOrCreateNotificationThread(db, participants);
  await messaging.insertSystemMessage(db, threadId, senderId, type, context);
}

export async function createBookingRequest(
  db: SupabaseLike,
  payload: BookingPayload,
  options: { messagingService?: MessagingServiceLike } = {},
): Promise<BookingRow> {
  await assertSlotAvailable(db, payload.professionalId, payload.companyId ?? null, payload.date, payload.startTime, payload.endTime);
  const booking = await insertBooking(db, payload, 'pending');
  await setPPLStatus(db, payload.patientId, payload.professionalId, payload.companyId ?? null, 'pending', payload.patientId);

  const messaging = options.messagingService ?? defaultMessagingService;
  await notify(db, messaging, [payload.patientId, payload.professionalId], payload.patientId, 'appointment_created', {
    appointmentId: booking.id,
    date: payload.date,
    professionalName: 'Professionista',
  });

  return booking;
}

export async function createAdminBooking(
  db: SupabaseLike,
  actorId: string,
  actorCompanyRole: string | null,
  payload: BookingPayload,
  options: { messagingService?: MessagingServiceLike } = {},
): Promise<BookingRow> {
  if (!payload.companyId && actorId !== payload.professionalId) {
    throw new BookingError('BOOKING_ACTOR_MISMATCH', 403);
  }
  if (payload.companyId && !['owner', 'admin', 'staff', 'profissional'].includes(actorCompanyRole ?? '')) {
    throw new BookingError('BOOKING_FORBIDDEN', 403);
  }

  await assertSlotAvailable(db, payload.professionalId, payload.companyId ?? null, payload.date, payload.startTime, payload.endTime);
  const booking = await insertBooking(db, payload, 'confirmed');
  await setPPLStatus(db, payload.patientId, payload.professionalId, payload.companyId ?? null, 'approved', actorId);

  const messaging = options.messagingService ?? defaultMessagingService;
  await notify(db, messaging, [payload.patientId, payload.professionalId], actorId, 'appointment_confirmed', {
    appointmentId: booking.id,
    date: payload.date,
    professionalName: 'Professionista',
  });

  return booking;
}

export async function confirmBooking(
  db: SupabaseLike,
  bookingId: string,
  actorId: string,
  options: { messagingService?: MessagingServiceLike } = {},
): Promise<BookingRow> {
  const current = await getBookingRow(db, bookingId);
  if (current.status !== 'pending') throw new BookingError('BOOKING_INVALID_STATUS', 422);
  if (current.professional_id !== actorId) throw new BookingError('BOOKING_FORBIDDEN', 403);

  const booking = await updateBookingStatus(db, bookingId, 'confirmed');
  await setPPLStatus(db, booking.patient_id!, booking.professional_id!, booking.company_id, 'approved', actorId);
  const messaging = options.messagingService ?? defaultMessagingService;
  await notify(db, messaging, [booking.patient_id!, booking.professional_id!], actorId, 'appointment_confirmed', {
    appointmentId: booking.id,
    date: booking.date,
    professionalName: 'Professionista',
  });

  const { data: treatment } = await db
    .from('treatments')
    .select('id, consent_template_id')
    .eq('booking_id', booking.id)
    .maybeSingle();
  if (treatment && (treatment as any).consent_template_id) {
    await createForTreatment(db, {
      templateId: String((treatment as any).consent_template_id),
      treatmentId: String((treatment as any).id),
      professionalId: booking.professional_id!,
      clientId: booking.patient_id!,
      companyId: booking.company_id,
      professionalRole: 'profissional',
    });
  }

  return booking;
}

export async function cancelBooking(
  db: SupabaseLike,
  bookingId: string,
  actorId: string,
  options: { messagingService?: MessagingServiceLike } = {},
): Promise<BookingRow> {
  const current = await getBookingRow(db, bookingId);
  if (!['pending', 'confirmed'].includes(current.status)) throw new BookingError('BOOKING_INVALID_STATUS', 422);
  if (![current.patient_id, current.professional_id].includes(actorId)) throw new BookingError('BOOKING_FORBIDDEN', 403);

  const booking = await updateBookingStatus(db, bookingId, 'cancelled');
  await setPPLStatus(db, booking.patient_id!, booking.professional_id!, booking.company_id, 'pending', actorId);
  const recipient = actorId === booking.patient_id ? booking.professional_id! : booking.patient_id!;
  const messaging = options.messagingService ?? defaultMessagingService;
  await notify(db, messaging, [booking.patient_id!, booking.professional_id!], actorId, 'appointment_cancelled', {
    appointmentId: booking.id,
    date: booking.date,
    reason: 'cancelled_by_user',
    recipient,
  });
  return booking;
}

export async function completeBooking(db: SupabaseLike, bookingId: string, actorId: string): Promise<BookingRow> {
  const current = await getBookingRow(db, bookingId);
  if (current.status !== 'confirmed') throw new BookingError('BOOKING_INVALID_STATUS', 422);
  if (current.professional_id !== actorId) throw new BookingError('BOOKING_FORBIDDEN', 403);
  return updateBookingStatus(db, bookingId, 'completed');
}

export async function markNoShow(db: SupabaseLike, bookingId: string, actorId: string): Promise<BookingRow> {
  const current = await getBookingRow(db, bookingId);
  if (current.status !== 'confirmed') throw new BookingError('BOOKING_INVALID_STATUS', 422);
  if (current.professional_id !== actorId) throw new BookingError('BOOKING_FORBIDDEN', 403);
  return updateBookingStatus(db, bookingId, 'no_show');
}

export async function listBookings(
  db: SupabaseLike,
  actorId: string,
  actorRole: string,
  filters: { status?: string; date?: string; companyId?: string; page: number; limit: number },
): Promise<PaginatedResult<BookingRow>> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = db.from('bookings').select('*', { count: 'exact' }).order('date', { ascending: true }).range(from, to);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date) query = query.eq('date', filters.date);
  if (['owner', 'admin', 'staff'].includes(actorRole)) {
    if (!filters.companyId) throw new BookingError('BOOKING_COMPANY_REQUIRED', 422);
    query = query.eq('company_id', filters.companyId);
  } else if (actorRole === 'profissional') {
    query = query.eq('professional_id', actorId);
  } else {
    query = query.eq('patient_id', actorId);
  }
  const { data, count, error } = await query;
  if (error) throw new BookingError('BOOKING_LIST_FAILED', 500);
  const total = count ?? 0;
  return { data: (data ?? []) as BookingRow[], total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getBooking(db: SupabaseLike, bookingId: string, actorId: string): Promise<BookingRow> {
  const booking = await getBookingRow(db, bookingId);
  if (booking.patient_id === actorId || booking.professional_id === actorId) return booking;
  if (booking.company_id) {
    const { data } = await db
      .from('company_members')
      .select('id')
      .eq('company_id', booking.company_id)
      .eq('user_id', actorId)
      .eq('is_active', true)
      .maybeSingle();
    if (data) return booking;
  }
  throw new BookingError('BOOKING_FORBIDDEN', 403);
}
