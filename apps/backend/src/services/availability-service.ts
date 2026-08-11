import type { SupabaseLike } from '../db/supabase';

export class AvailabilityError extends Error {
  constructor(public code: string, public statusCode: number, message = code) {
    super(message);
  }
}

export type BookingAvailabilityRow = {
  id: string;
  professional_id: string;
  company_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
};

export type WeeklyScheduleRow = {
  dayOfWeek: number;
  isAvailable: boolean;
  windows: BookingAvailabilityRow[];
};

export type BookingBlockedSlotRow = {
  id: string;
  professional_id: string;
  company_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  created_at?: string;
};

export type BookingSettingsRow = {
  id?: string;
  professional_id: string;
  online_booking_enabled: boolean;
  first_slot: string;
  last_slot: string;
  conferma_prenotazione: boolean;
  promemoria_visita: boolean;
  conferma_presenza: boolean;
  richiesta_recensione: boolean;
  invito_prossima_visita: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CompanyRoomRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  capacity: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const defaultSettings = (professionalId: string): BookingSettingsRow => ({
  professional_id: professionalId,
  online_booking_enabled: false,
  first_slot: 'domani',
  last_slot: '12 settimane',
  conferma_prenotazione: false,
  promemoria_visita: false,
  conferma_presenza: false,
  richiesta_recensione: false,
  invito_prossima_visita: false,
});

function minutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function assertRange(startTime: string, endTime: string, minimumMinutes = 30) {
  if (minutes(startTime) >= minutes(endTime)) throw new AvailabilityError('INVALID_TIME_RANGE', 400);
  if (minutes(endTime) - minutes(startTime) < minimumMinutes) throw new AvailabilityError('TIME_RANGE_TOO_SHORT', 400);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return minutes(aStart) < minutes(bEnd) && minutes(aEnd) > minutes(bStart);
}

function applyCompanyFilter(query: any, companyId: string | null) {
  return companyId ? query.eq('company_id', companyId) : query.is('company_id', null);
}

export async function getWeeklySchedule(db: SupabaseLike, professionalId: string, companyId: string | null): Promise<WeeklyScheduleRow[]> {
  let query = db
    .from('booking_availability')
    .select('*')
    .eq('professional_id', professionalId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  query = applyCompanyFilter(query, companyId);
  const { data, error } = await query;
  if (error) throw new AvailabilityError('SCHEDULE_LIST_FAILED', 500);

  const rows = (data ?? []) as BookingAvailabilityRow[];
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const windows = rows.filter((row) => row.day_of_week === dayOfWeek);
    return { dayOfWeek, isAvailable: windows.some((row) => row.is_available), windows };
  });
}

export async function upsertAvailabilityWindow(
  db: SupabaseLike,
  professionalId: string,
  companyId: string | null,
  payload: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean },
): Promise<BookingAvailabilityRow> {
  assertRange(payload.startTime, payload.endTime);

  let existingQuery = db
    .from('booking_availability')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('day_of_week', payload.dayOfWeek);
  existingQuery = applyCompanyFilter(existingQuery, companyId);
  const { data: existingRows } = await existingQuery;
  const conflict = ((existingRows ?? []) as BookingAvailabilityRow[]).some((row) =>
    row.is_available && payload.isAvailable && overlaps(payload.startTime, payload.endTime, row.start_time, row.end_time),
  );
  if (conflict) throw new AvailabilityError('SCHEDULE_OVERLAP', 409);

  const { data, error } = await db.from('booking_availability').insert({
    professional_id: professionalId,
    company_id: companyId,
    day_of_week: payload.dayOfWeek,
    start_time: payload.startTime,
    end_time: payload.endTime,
    is_available: payload.isAvailable,
    updated_at: new Date().toISOString(),
  }).select('*').single();
  if (error || !data) throw new AvailabilityError('SCHEDULE_UPSERT_FAILED', 500);
  return data as BookingAvailabilityRow;
}

export async function deleteAvailabilityWindow(db: SupabaseLike, windowId: string, professionalId: string): Promise<void> {
  const { data } = await db.from('booking_availability').select('*').eq('id', windowId).eq('professional_id', professionalId).maybeSingle();
  if (!data) throw new AvailabilityError('WINDOW_NOT_FOUND', 404);
  const { error } = await db.from('booking_availability').delete().eq('id', windowId).eq('professional_id', professionalId);
  if (error) throw new AvailabilityError('WINDOW_DELETE_FAILED', 500);
}

export async function listBlockedSlots(
  db: SupabaseLike,
  professionalId: string,
  companyId: string | null,
  filters: { from?: string; to?: string },
): Promise<BookingBlockedSlotRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  let query = db
    .from('booking_blocked_slots')
    .select('*')
    .eq('professional_id', professionalId)
    .gte('date', filters.from ?? today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  query = applyCompanyFilter(query, companyId);
  if (filters.to) query = query.lte('date', filters.to);
  const { data, error } = await query;
  if (error) throw new AvailabilityError('BLOCKED_SLOT_LIST_FAILED', 500);
  return (data ?? []) as BookingBlockedSlotRow[];
}

export async function createBlockedSlot(
  db: SupabaseLike,
  professionalId: string,
  companyId: string | null,
  payload: { date: string; startTime: string; endTime: string; reason?: string },
): Promise<BookingBlockedSlotRow> {
  assertRange(payload.startTime, payload.endTime);
  const today = new Date().toISOString().slice(0, 10);
  if (payload.date < today) throw new AvailabilityError('BLOCKED_SLOT_PAST_DATE', 400);

  let conflictQuery = db
    .from('booking_blocked_slots')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('date', payload.date)
    .lt('start_time', payload.endTime)
    .gt('end_time', payload.startTime);
  conflictQuery = applyCompanyFilter(conflictQuery, companyId);
  const { data: conflict } = await conflictQuery.maybeSingle();
  if (conflict) throw new AvailabilityError('BLOCKED_SLOT_OVERLAP', 409);

  const { data, error } = await db.from('booking_blocked_slots').insert({
    professional_id: professionalId,
    company_id: companyId,
    date: payload.date,
    start_time: payload.startTime,
    end_time: payload.endTime,
    reason: payload.reason ?? null,
  }).select('*').single();
  if (error || !data) throw new AvailabilityError('BLOCKED_SLOT_CREATE_FAILED', 500);
  return data as BookingBlockedSlotRow;
}

export async function deleteBlockedSlot(db: SupabaseLike, slotId: string, professionalId: string): Promise<void> {
  const { data } = await db.from('booking_blocked_slots').select('*').eq('id', slotId).eq('professional_id', professionalId).maybeSingle();
  if (!data) throw new AvailabilityError('BLOCKED_SLOT_NOT_FOUND', 404);
  const { error } = await db.from('booking_blocked_slots').delete().eq('id', slotId).eq('professional_id', professionalId);
  if (error) throw new AvailabilityError('BLOCKED_SLOT_DELETE_FAILED', 500);
}

export async function getBookingSettings(db: SupabaseLike, professionalId: string): Promise<BookingSettingsRow> {
  const { data, error } = await db.from('booking_settings').select('*').eq('professional_id', professionalId).maybeSingle();
  if (error) throw new AvailabilityError('BOOKING_SETTINGS_READ_FAILED', 500);
  return (data as BookingSettingsRow | null) ?? defaultSettings(professionalId);
}

export async function upsertBookingSettings(
  db: SupabaseLike,
  professionalId: string,
  payload: Partial<{
    onlineBookingEnabled: boolean;
    firstSlot: string;
    lastSlot: string;
    confermaPrenotazione: boolean;
    promemoriaVisita: boolean;
    confermaPresenza: boolean;
    richiestaRecensione: boolean;
    invitoProssimaVisita: boolean;
  }>,
): Promise<BookingSettingsRow> {
  const { data, error } = await db.from('booking_settings').upsert({
    professional_id: professionalId,
    online_booking_enabled: payload.onlineBookingEnabled,
    first_slot: payload.firstSlot,
    last_slot: payload.lastSlot,
    conferma_prenotazione: payload.confermaPrenotazione,
    promemoria_visita: payload.promemoriaVisita,
    conferma_presenza: payload.confermaPresenza,
    richiesta_recensione: payload.richiestaRecensione,
    invito_prossima_visita: payload.invitoProssimaVisita,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'professional_id' }).select('*').single();
  if (error || !data) throw new AvailabilityError('BOOKING_SETTINGS_SAVE_FAILED', 500);
  return data as BookingSettingsRow;
}

export async function listRooms(db: SupabaseLike, companyId: string): Promise<CompanyRoomRow[]> {
  if (!companyId) throw new AvailabilityError('COMPANY_REQUIRED', 400);
  const { data, error } = await db.from('company_rooms').select('*').eq('company_id', companyId).eq('is_active', true).order('name');
  if (error) throw new AvailabilityError('ROOM_LIST_FAILED', 500);
  return (data ?? []) as CompanyRoomRow[];
}

export async function createRoom(
  db: SupabaseLike,
  companyId: string,
  payload: { name: string; description?: string; capacity?: number },
): Promise<CompanyRoomRow> {
  if (!companyId) throw new AvailabilityError('COMPANY_REQUIRED', 400);
  const { data, error } = await db.from('company_rooms').insert({
    company_id: companyId,
    name: payload.name,
    description: payload.description ?? null,
    capacity: payload.capacity ?? 1,
    is_active: true,
    updated_at: new Date().toISOString(),
  }).select('*').single();
  if (error || !data) throw new AvailabilityError('ROOM_CREATE_FAILED', 500);
  return data as CompanyRoomRow;
}

export async function updateRoom(
  db: SupabaseLike,
  roomId: string,
  companyId: string,
  payload: Partial<{ name: string; description: string; capacity: number; isActive: boolean }>,
): Promise<CompanyRoomRow> {
  if (!companyId) throw new AvailabilityError('COMPANY_REQUIRED', 400);
  const { data, error } = await db.from('company_rooms').update({
    name: payload.name,
    description: payload.description,
    capacity: payload.capacity,
    is_active: payload.isActive,
    updated_at: new Date().toISOString(),
  }).eq('id', roomId).eq('company_id', companyId).select('*').single();
  if (error || !data) throw new AvailabilityError('ROOM_UPDATE_FAILED', 500);
  return data as CompanyRoomRow;
}
