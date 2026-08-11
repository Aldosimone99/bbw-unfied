import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertSlotAvailable,
  getAvailableDays,
  getAvailableSlots,
  resolveSlotWindow,
  SlotsError,
} from '../../services/slots-service';

const professionalId = '11111111-1111-4111-8111-111111111111';

function makeDb() {
  const state = {
    booking_settings: [{ professional_id: professionalId, online_booking_enabled: true, first_slot: 'domani', last_slot: '12 settimane' }],
    booking_availability: [{ professional_id: professionalId, company_id: null, day_of_week: 5, start_time: '09:00', end_time: '10:30', is_available: true }],
    booking_blocked_slots: [] as any[],
    bookings: [] as any[],
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
    in: vi.fn((field: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[field]));
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
    maybeSingle: vi.fn(async () => ({ data: state[table].find((row: any) => filters.every((fn) => fn(row))) ?? null, error: null })),
    order: vi.fn(() => builder),
  };
  builder.then = (resolve: any) => resolve({ data: state[table].filter((row: any) => filters.every((fn) => fn(row))), error: null });
  return builder;
}

describe('slots-service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
  });

  it('resolves first and last slot windows', () => {
    const window = resolveSlotWindow({ first_slot: '3 giorni', last_slot: '4 settimane' }, new Date('2026-06-25T12:00:00.000Z'));
    expect(window.minDate.toISOString().slice(0, 10)).toBe('2026-06-28');
    expect(window.maxDate.toISOString().slice(0, 10)).toBe('2026-07-23');
  });

  it('returns 30 minute slots and removes bookings', async () => {
    const db = makeDb();
    db.state.bookings.push({
      professional_id: professionalId,
      date: '2026-06-26',
      start_time: '09:30',
      end_time: '10:00',
      status: 'confirmed',
    });

    const slots = await getAvailableSlots(db, professionalId, null, '2026-06-26');

    expect(slots).toEqual([
      { startTime: '09:00', endTime: '09:30' },
      { startTime: '10:00', endTime: '10:30' },
    ]);
  });

  it('returns available days when at least one slot remains', async () => {
    const days = await getAvailableDays(makeDb(), professionalId, null, { from: '2026-06-26', to: '2026-06-30' });
    expect(days).toContain('2026-06-26');
  });

  it('throws when requested slot is unavailable', async () => {
    const db = makeDb();
    await expect(assertSlotAvailable(db, professionalId, null, '2026-06-26', '11:00', '11:30'))
      .rejects.toBeInstanceOf(SlotsError);
  });
});
