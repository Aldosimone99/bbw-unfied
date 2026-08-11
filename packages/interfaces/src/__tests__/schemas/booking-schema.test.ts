import { describe, expect, it } from 'vitest';
import {
  bookingListResponseSchema,
  bookingRowSchema,
  createAdminBookingSchema,
  createBookingRequestSchema,
  createPPLInviteSchema,
  pplInviteLookupResponseSchema,
  pplInviteRowSchema,
} from '../../schemas/booking-schema';

describe('booking schemas', () => {
  it('accepts a valid patient booking request', () => {
    const parsed = createBookingRequestSchema.parse({
      professionalId: '11111111-1111-4111-8111-111111111111',
      companyId: '22222222-2222-4222-8222-222222222222',
      serviceId: '33333333-3333-4333-8333-333333333333',
      serviceName: 'Visita estetica',
      date: '2026-07-01',
      startTime: '09:00',
      endTime: '09:30',
      duration: 30,
      notes: 'Prima visita',
      priceCents: 7500,
    });

    expect(parsed.duration).toBe(30);
    expect(parsed.priceCents).toBe(7500);
  });

  it('rejects unknown fields and invalid duration', () => {
    const result = createBookingRequestSchema.safeParse({
      professionalId: '11111111-1111-4111-8111-111111111111',
      serviceName: 'Visita estetica',
      date: '2026-07-01',
      startTime: '09:00',
      endTime: '09:30',
      duration: 20,
      extra: true,
    });

    expect(result.success).toBe(false);
  });

  it('requires patientId for admin bookings', () => {
    const result = createAdminBookingSchema.safeParse({
      professionalId: '11111111-1111-4111-8111-111111111111',
      serviceName: 'Visita estetica',
      date: '2026-07-01',
      startTime: '09:00',
      endTime: '09:30',
      duration: 30,
    });

    expect(result.success).toBe(false);
  });

  it('parses booking rows and list responses', () => {
    const row = bookingRowSchema.parse({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      professional_id: '11111111-1111-4111-8111-111111111111',
      patient_id: '44444444-4444-4444-8444-444444444444',
      company_id: null,
      room_id: null,
      service_id: null,
      service_name: 'Visita',
      date: '2026-07-01',
      start_time: '09:00:00',
      end_time: '09:30:00',
      duration: 30,
      status: 'pending',
      notes: null,
      price_cents: 7500,
      points: null,
      created_at: '2026-06-25T12:00:00.000Z',
      updated_at: '2026-06-25T12:00:00.000Z',
    });

    expect(row.status).toBe('pending');
    expect(bookingListResponseSchema.parse({ data: [row], total: 1, page: 1, limit: 20, pages: 1 }).total).toBe(1);
  });

  it('parses PPL invite requests, rows, and lookup responses', () => {
    expect(createPPLInviteSchema.parse({
      email: 'cliente@example.com',
      nome: 'Ada',
      cognome: 'Rossi',
      expiresInDays: 7,
    }).email).toBe('cliente@example.com');

    const invite = pplInviteRowSchema.parse({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      professional_id: '11111111-1111-4111-8111-111111111111',
      company_id: null,
      patient_id: null,
      email: 'cliente@example.com',
      nome: 'Ada',
      cognome: 'Rossi',
      status: 'pending',
      expires_at: '2026-07-02T12:00:00.000Z',
      accepted_at: null,
      created_at: '2026-06-25T12:00:00.000Z',
    });

    expect(invite.status).toBe('pending');
    expect(pplInviteLookupResponseSchema.parse({
      id: invite.id,
      email: invite.email,
      nome: invite.nome,
      cognome: invite.cognome,
      professionalId: invite.professional_id,
      professionalName: 'Dott.ssa Bianchi',
      clinicName: null,
      expiresAt: invite.expires_at,
      status: 'pending',
    }).professionalName).toBe('Dott.ssa Bianchi');
  });
});
