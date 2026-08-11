import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AvailabilityError,
  createBlockedSlot,
  createRoom,
  getBookingSettings,
  getWeeklySchedule,
  upsertAvailabilityWindow,
} from '../../services/availability-service';

const professionalId = '11111111-1111-4111-8111-111111111111';
const companyId = '22222222-2222-4222-8222-222222222222';

function makeDb() {
  const state = {
    booking_availability: [] as any[],
    booking_blocked_slots: [] as any[],
    booking_settings: [] as any[],
    company_rooms: [] as any[],
  };
  return { state, from: vi.fn((table: keyof typeof state) => queryBuilder(state, table)) } as any;
}

function queryBuilder(state: any, table: string) {
  const filters: Array<(row: any) => boolean> = [];
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((field: string, value: unknown) => {
      filters.push((row) => row[field] === value);
      return builder;
    }),
    is: vi.fn((field: string, value: null) => {
      filters.push((row) => row[field] === value);
      return builder;
    }),
    gte: vi.fn((field: string, value: string) => {
      filters.push((row) => row[field] >= value);
      return builder;
    }),
    lte: vi.fn((field: string, value: string) => {
      filters.push((row) => row[field] <= value);
      return builder;
    }),
    lt: vi.fn((field: string, value: string) => {
      filters.push((row) => row[field] < value);
      return builder;
    }),
    gt: vi.fn((field: string, value: string) => {
      filters.push((row) => row[field] > value);
      return builder;
    }),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: state[table].find((row: any) => filters.every((fn) => fn(row))) ?? null, error: null })),
    single: vi.fn(async () => ({ data: builder._last, error: builder._last ? null : { message: 'missing' } })),
    insert: vi.fn((payload: any) => {
      const row = { id: `${table}-${state[table].length + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
      state[table].push(row);
      builder._last = row;
      return builder;
    }),
    upsert: vi.fn((payload: any) => {
      const row = { id: payload.id ?? `${table}-${state[table].length + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
      state[table].push(row);
      builder._last = row;
      return builder;
    }),
    update: vi.fn((payload: any) => {
      const row = state[table].find((item: any) => filters.every((fn) => fn(item)));
      if (row) Object.assign(row, payload);
      builder._last = row;
      return builder;
    }),
    delete: vi.fn(() => {
      const index = state[table].findIndex((item: any) => filters.every((fn) => fn(item)));
      if (index >= 0) state[table].splice(index, 1);
      return builder;
    }),
  };
  builder.then = (resolve: any) => resolve({ data: state[table].filter((row: any) => filters.every((fn) => fn(row))), error: null });
  return builder;
}

describe('availability-service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
  });

  it('returns seven weekly schedule entries', async () => {
    const db = makeDb();
    db.state.booking_availability.push({
      id: 'window-1',
      professional_id: professionalId,
      company_id: null,
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      is_available: true,
    });

    const schedule = await getWeeklySchedule(db, professionalId, null);

    expect(schedule).toHaveLength(7);
    expect(schedule[1]).toMatchObject({ dayOfWeek: 1, isAvailable: true });
  });

  it('rejects overlapping availability windows', async () => {
    const db = makeDb();
    db.state.booking_availability.push({
      id: 'window-1',
      professional_id: professionalId,
      company_id: null,
      day_of_week: 1,
      start_time: '09:00',
      end_time: '12:00',
      is_available: true,
    });

    await expect(upsertAvailabilityWindow(db, professionalId, null, {
      dayOfWeek: 1,
      startTime: '11:00',
      endTime: '13:00',
      isAvailable: true,
    })).rejects.toMatchObject({ code: 'SCHEDULE_OVERLAP', statusCode: 409 });
  });

  it('creates future blocked slot and rejects past dates', async () => {
    const db = makeDb();

    await expect(createBlockedSlot(db, professionalId, null, {
      date: '2026-06-24',
      startTime: '10:00',
      endTime: '11:00',
    })).rejects.toMatchObject({ code: 'BLOCKED_SLOT_PAST_DATE', statusCode: 400 });

    const slot = await createBlockedSlot(db, professionalId, null, {
      date: '2026-06-26',
      startTime: '10:00',
      endTime: '11:00',
      reason: 'Ferie',
    });

    expect(slot.reason).toBe('Ferie');
  });

  it('returns default settings when no row exists', async () => {
    const settings = await getBookingSettings(makeDb(), professionalId);
    expect(settings).toMatchObject({
      professional_id: professionalId,
      online_booking_enabled: false,
      first_slot: 'domani',
      last_slot: '12 settimane',
    });
  });

  it('requires companyId for room creation', async () => {
    await expect(createRoom(makeDb(), null as any, { name: 'Sala 1' })).rejects.toBeInstanceOf(AvailabilityError);
    await expect(createRoom(makeDb(), companyId, { name: 'Sala 1' })).resolves.toMatchObject({ name: 'Sala 1' });
  });
});
