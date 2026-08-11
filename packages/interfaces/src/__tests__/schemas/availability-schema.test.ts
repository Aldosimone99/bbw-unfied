import { describe, expect, it } from 'vitest';
import {
  availableSlotSchema,
  bookingAvailabilityRowSchema,
  bookingSettingsPayloadSchema,
  companyRoomRowSchema,
  createBlockedSlotSchema,
  createRoomSchema,
  publicProfileResponseSchema,
  upsertAvailabilityWindowSchema,
} from '../../schemas/availability-schema';

describe('availability schemas', () => {
  it('parses strict availability window payloads', () => {
    expect(upsertAvailabilityWindowSchema.parse({
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      isAvailable: true,
    }).dayOfWeek).toBe(1);

    expect(upsertAvailabilityWindowSchema.safeParse({
      dayOfWeek: 8,
      startTime: '09:00',
      endTime: '17:00',
      isAvailable: true,
      extra: 'no',
    }).success).toBe(false);
  });

  it('parses blocked slot, settings, room, and slot payloads', () => {
    expect(createBlockedSlotSchema.parse({
      date: '2026-07-01',
      startTime: '10:00',
      endTime: '11:00',
      reason: 'Ferie',
    }).date).toBe('2026-07-01');

    expect(bookingSettingsPayloadSchema.parse({
      onlineBookingEnabled: true,
      firstSlot: 'domani',
      lastSlot: '12 settimane',
      promemoriaVisita: true,
    }).onlineBookingEnabled).toBe(true);

    expect(createRoomSchema.parse({ name: 'Sala 1', capacity: 2 }).capacity).toBe(2);
    expect(availableSlotSchema.parse({ startTime: '09:00', endTime: '09:30' }).startTime).toBe('09:00');
  });

  it('parses database rows and public profile response', () => {
    expect(bookingAvailabilityRowSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      professional_id: '22222222-2222-4222-8222-222222222222',
      company_id: null,
      day_of_week: 1,
      start_time: '09:00:00',
      end_time: '17:00:00',
      is_available: true,
      created_at: '2026-06-25T12:00:00.000Z',
      updated_at: '2026-06-25T12:00:00.000Z',
    }).is_available).toBe(true);

    expect(companyRoomRowSchema.parse({
      id: '33333333-3333-4333-8333-333333333333',
      company_id: '44444444-4444-4444-8444-444444444444',
      name: 'Sala Laser',
      description: null,
      capacity: 1,
      is_active: true,
      created_at: '2026-06-25T12:00:00.000Z',
      updated_at: '2026-06-25T12:00:00.000Z',
    }).name).toBe('Sala Laser');

    expect(publicProfileResponseSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      nome: 'Mario',
      cognome: 'Rossi',
      profile_slug: 'mario-rossi-k3x9',
      tipo_utente: 'medico',
      specializzazioni: ['Dermatologia'],
      bio: null,
      photo_url: null,
      online_booking_enabled: true,
    }).online_booking_enabled).toBe(true);
  });
});
