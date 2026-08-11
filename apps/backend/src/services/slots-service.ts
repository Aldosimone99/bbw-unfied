import type { SupabaseLike } from '../db/supabase';

export class SlotsError extends Error {
  constructor(public code: string, public statusCode: number, message = code) {
    super(message);
  }
}

type SettingsLike = {
  online_booking_enabled?: boolean;
  first_slot?: string;
  last_slot?: string;
};

type Slot = { startTime: string; endTime: string };

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function minutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(value: number): string {
  const hour = String(Math.floor(value / 60)).padStart(2, '0');
  const minute = String(value % 60).padStart(2, '0');
  return `${hour}:${minute}`;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return minutes(aStart) < minutes(bEnd) && minutes(aEnd) > minutes(bStart);
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function applyCompanyFilter(query: any, companyId: string | null) {
  return companyId ? query.eq('company_id', companyId) : query.is('company_id', null);
}

export function resolveSlotWindow(settings: SettingsLike, today = new Date()): { minDate: Date; maxDate: Date } {
  const firstSlotDays: Record<string, number> = { domani: 1, '3 giorni': 3, '1 settimana': 7 };
  const lastSlotDays: Record<string, number> = { '4 settimane': 28, '8 settimane': 56, '12 settimane': 84 };
  return {
    minDate: addDays(today, firstSlotDays[settings.first_slot ?? 'domani'] ?? 1),
    maxDate: addDays(today, lastSlotDays[settings.last_slot ?? '12 settimane'] ?? 84),
  };
}

async function getSettings(db: SupabaseLike, professionalId: string): Promise<SettingsLike> {
  const { data } = await db.from('booking_settings').select('*').eq('professional_id', professionalId).maybeSingle();
  return (data as SettingsLike | null) ?? { online_booking_enabled: false, first_slot: 'domani', last_slot: '12 settimane' };
}

function splitWindow(startTime: string, endTime: string): Slot[] {
  const slots: Slot[] = [];
  for (let start = minutes(startTime); start + 30 <= minutes(endTime); start += 30) {
    slots.push({ startTime: timeFromMinutes(start), endTime: timeFromMinutes(start + 30) });
  }
  return slots;
}

async function getWindows(db: SupabaseLike, professionalId: string, companyId: string | null, date: string) {
  let query = db
    .from('booking_availability')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek(date))
    .eq('is_available', true)
    .order('start_time', { ascending: true });
  query = applyCompanyFilter(query, companyId);
  const { data, error } = await query;
  if (error) throw new SlotsError('AVAILABILITY_READ_FAILED', 500);
  return (data ?? []) as Array<{ start_time: string; end_time: string }>;
}

async function getBlockedSlots(db: SupabaseLike, professionalId: string, companyId: string | null, date: string) {
  let query = db
    .from('booking_blocked_slots')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('date', date);
  query = applyCompanyFilter(query, companyId);
  const { data, error } = await query;
  if (error) throw new SlotsError('BLOCKED_SLOT_READ_FAILED', 500);
  return (data ?? []) as Array<{ start_time: string; end_time: string }>;
}

async function getBusyBookings(db: SupabaseLike, professionalId: string, date: string) {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('date', date)
    .in('status', ['pending', 'confirmed']);
  if (error) throw new SlotsError('BOOKING_READ_FAILED', 500);
  return (data ?? []) as Array<{ start_time: string; end_time: string }>;
}

function insideSettingsWindow(date: string, settings: SettingsLike): boolean {
  const { minDate, maxDate } = resolveSlotWindow(settings, new Date());
  return date >= dateOnly(minDate) && date <= dateOnly(maxDate);
}

export async function getAvailableSlots(
  db: SupabaseLike,
  professionalId: string,
  companyId: string | null,
  date: string,
): Promise<Slot[]> {
  const settings = await getSettings(db, professionalId);
  if (!settings.online_booking_enabled) return [];
  if (!insideSettingsWindow(date, settings)) return [];

  const windows = await getWindows(db, professionalId, companyId, date);
  const blocked = await getBlockedSlots(db, professionalId, companyId, date);
  const bookings = await getBusyBookings(db, professionalId, date);
  const conflicts = [...blocked, ...bookings];

  return windows
    .flatMap((window) => splitWindow(window.start_time, window.end_time))
    .filter((slot) => !conflicts.some((conflict) => overlaps(slot.startTime, slot.endTime, conflict.start_time, conflict.end_time)));
}

export async function getAvailableDays(
  db: SupabaseLike,
  professionalId: string,
  companyId: string | null,
  range: { from: string; to: string },
): Promise<string[]> {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T00:00:00.000Z`);
  const days = Math.floor((to.getTime() - from.getTime()) / 86400000);
  if (days > 60) throw new SlotsError('RANGE_TOO_LARGE', 400);

  const result: string[] = [];
  for (let offset = 0; offset <= days; offset += 1) {
    const date = dateOnly(addDays(from, offset));
    const slots = await getAvailableSlots(db, professionalId, companyId, date);
    if (slots.length > 0) result.push(date);
  }
  return result;
}

export async function assertSlotAvailable(
  db: SupabaseLike,
  professionalId: string,
  companyId: string | null,
  date: string,
  startTime: string,
  endTime: string,
): Promise<void> {
  const slots = await getAvailableSlots(db, professionalId, companyId, date);
  const match = slots.some((slot) => slot.startTime === startTime && slot.endTime === endTime);
  if (!match) throw new SlotsError('SLOT_NOT_AVAILABLE', 409);
}
