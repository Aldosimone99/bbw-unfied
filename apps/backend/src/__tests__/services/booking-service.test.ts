import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BookingError,
  cancelBooking,
  completeBooking,
  confirmBooking,
  createAdminBooking,
  createBookingRequest,
  markNoShow,
} from '../../services/booking-service';

vi.mock('../../services/slots-service', () => ({
  assertSlotAvailable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/consent-document-service', () => ({
  createForTreatment: vi.fn().mockResolvedValue({ id: 'consent-1' }),
}));

const ids = {
  professional: '11111111-1111-4111-8111-111111111111',
  patient: '22222222-2222-4222-8222-222222222222',
  company: '33333333-3333-4333-8333-333333333333',
  booking: '44444444-4444-4444-8444-444444444444',
};

function makeDb() {
  const state = {
    bookings: [] as any[],
    booking_availability: [{
      professional_id: ids.professional,
      company_id: null,
      day_of_week: 3,
      start_time: '09:00:00',
      end_time: '18:00:00',
      is_available: true,
    }],
    booking_blocked_slots: [] as any[],
    patient_professional_links: [] as any[],
    company_members: [] as any[],
    treatments: [] as any[],
    consent_templates: [] as any[],
    consent_documents: [] as any[],
    consent_document_versions: [] as any[],
    consent_audit_logs: [] as any[],
    message_threads: [] as any[],
    message_messages: [] as any[],
  };
  return { state, from: vi.fn((table: keyof typeof state) => createQuery(state, table)) } as any;
}

function createQuery(state: any, table: string) {
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
    lte: vi.fn((field: string, value: string) => {
      filters.push((row) => row[field] <= value);
      return builder;
    }),
    gte: vi.fn((field: string, value: string) => {
      filters.push((row) => row[field] >= value);
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
    contains: vi.fn((field: string, value: unknown[]) => {
      const arr = Array.isArray(value) ? value : [value];
      filters.push((row) => arr.every((v) => (row[field] ?? []).includes(v)));
      return builder;
    }),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      if (builder._update) {
        const matched = state[table].filter((row: any) => filters.every((fn) => fn(row)));
        matched.forEach((row: any) => Object.assign(row, builder._update));
        builder._update = null;
      }
      return { data: state[table].filter((row: any) => filters.every((fn) => fn(row)))[0] ?? null, error: null };
    }),
    single: vi.fn(async () => {
      if (builder._update) {
        const matched = state[table].filter((row: any) => filters.every((fn) => fn(row)));
        matched.forEach((row: any) => Object.assign(row, builder._update));
        builder._update = null;
        builder._last = matched[0] ?? null;
      }
      return { data: builder._last ?? state[table].filter((row: any) => filters.every((fn) => fn(row)))[0] ?? null, error: null };
    }),
    insert: vi.fn((payload: any) => {
      const row = { id: payload.id ?? ids.booking, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
      state[table].push(row);
      builder._last = row;
      return builder;
    }),
    update: vi.fn((payload: any) => {
      builder._update = payload;
      return builder;
    }),
    upsert: vi.fn((payload: any) => {
      state[table].push({ id: `${table}-${state[table].length + 1}`, ...payload });
      builder._last = state[table][state[table].length - 1];
      return builder;
    }),
  };
  return builder;
}

describe('booking-service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
  });

  it('creates patient request as pending and pending PPL', async () => {
    const db = makeDb();
    const messagingService = {
      getOrCreateNotificationThread: vi.fn().mockResolvedValue('thread-1'),
      insertSystemMessage: vi.fn().mockResolvedValue(undefined),
    };

    const booking = await createBookingRequest(db, {
      patientId: ids.patient,
      professionalId: ids.professional,
      serviceName: 'Visita',
      date: '2026-07-01',
      startTime: '09:00',
      endTime: '09:30',
      duration: 30,
      priceCents: 7500,
    }, { messagingService });

    expect(booking.status).toBe('pending');
    expect(db.state.patient_professional_links[0]).toMatchObject({
      patient_id: ids.patient,
      professional_id: ids.professional,
      status: 'pending',
    });
    const { assertSlotAvailable } = await import('../../services/slots-service');
    expect(assertSlotAvailable).toHaveBeenCalledWith(
      db,
      ids.professional,
      null,
      '2026-07-01',
      '09:00',
      '09:30',
    );
  });

  it('rejects unavailable slots', async () => {
    const { assertSlotAvailable } = await import('../../services/slots-service');
    vi.mocked(assertSlotAvailable).mockRejectedValueOnce({ code: 'SLOT_NOT_AVAILABLE', statusCode: 409 });
    const db = makeDb();

    await expect(createBookingRequest(db, {
      patientId: ids.patient,
      professionalId: ids.professional,
      serviceName: 'Visita',
      date: '2026-07-01',
      startTime: '09:15',
      endTime: '09:45',
      duration: 30,
    })).rejects.toMatchObject({ code: 'SLOT_NOT_AVAILABLE', statusCode: 409 });
  });

  it('creates admin booking confirmed and approves PPL', async () => {
    const db = makeDb();

    const booking = await createAdminBooking(db, ids.professional, null, {
      patientId: ids.patient,
      professionalId: ids.professional,
      serviceName: 'Visita',
      date: '2026-07-01',
      startTime: '10:00',
      endTime: '10:30',
      duration: 30,
    });

    expect(booking.status).toBe('confirmed');
    expect(db.state.patient_professional_links[0].status).toBe('approved');
  });

  it('confirms pending bookings and approves PPL', async () => {
    const db = makeDb();
    db.state.bookings.push({
      id: ids.booking,
      professional_id: ids.professional,
      patient_id: ids.patient,
      company_id: null,
      date: '2026-07-01',
      start_time: '09:00:00',
      end_time: '09:30:00',
      duration: 30,
      status: 'pending',
    });

    const booking = await confirmBooking(db, ids.booking, ids.professional);
    expect(booking.status).toBe('confirmed');
    expect(db.state.patient_professional_links[0].status).toBe('approved');
  });

  it('does not allow actor mismatch for personal admin booking', async () => {
    const db = makeDb();
    await expect(createAdminBooking(db, ids.patient, null, {
      patientId: ids.patient,
      professionalId: ids.professional,
      serviceName: 'Visita',
      date: '2026-07-01',
      startTime: '11:00',
      endTime: '11:30',
      duration: 30,
    })).rejects.toBeInstanceOf(BookingError);
  });

  it('cancels pending booking', async () => {
    const db = makeDb();
    db.state.bookings.push({
      id: ids.booking,
      professional_id: ids.professional,
      patient_id: ids.patient,
      company_id: null,
      date: '2026-07-01',
      start_time: '09:00:00',
      end_time: '09:30:00',
      duration: 30,
      status: 'pending',
    });

    const booking = await cancelBooking(db, ids.booking, ids.patient);
    expect(booking.status).toBe('cancelled');
  });

  it('completes confirmed booking', async () => {
    const db = makeDb();
    db.state.bookings.push({
      id: ids.booking,
      professional_id: ids.professional,
      patient_id: ids.patient,
      company_id: null,
      date: '2026-07-01',
      start_time: '09:00:00',
      end_time: '09:30:00',
      duration: 30,
      status: 'confirmed',
    });

    const booking = await completeBooking(db, ids.booking, ids.professional);
    expect(booking.status).toBe('completed');
  });

  it('marks no-show for confirmed booking', async () => {
    const db = makeDb();
    db.state.bookings.push({
      id: ids.booking,
      professional_id: ids.professional,
      patient_id: ids.patient,
      company_id: null,
      date: '2026-07-01',
      start_time: '09:00:00',
      end_time: '09:30:00',
      duration: 30,
      status: 'confirmed',
    });

    const booking = await markNoShow(db, ids.booking, ids.professional);
    expect(booking.status).toBe('no_show');
  });

  it('creates consent document when booking confirmed with consent_template_id', async () => {
    const db = makeDb();
    db.state.bookings.push({
      id: ids.booking,
      professional_id: ids.professional,
      patient_id: ids.patient,
      company_id: null,
      date: '2026-07-01',
      start_time: '09:00:00',
      end_time: '09:30:00',
      duration: 30,
      status: 'pending',
    });
    db.state.treatments.push({
      id: 'treatment-1',
      booking_id: ids.booking,
      consent_template_id: 'template-1',
    });

    const { createForTreatment } = await import('../../services/consent-document-service');
    await confirmBooking(db, ids.booking, ids.professional);
    expect(createForTreatment).toHaveBeenCalledWith(db, expect.objectContaining({
      professionalId: ids.professional,
      clientId: ids.patient,
    }));
  });
});
