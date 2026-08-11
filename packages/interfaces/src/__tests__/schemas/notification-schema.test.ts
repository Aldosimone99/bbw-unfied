import { describe, expect, it } from 'vitest';
import {
  messageRowSchema,
  notificationThreadSchema,
  systemMessageContextSchema,
} from '../../schemas/notification-schema';

describe('notification schemas', () => {
  it('parses company invite context', () => {
    const parsed = systemMessageContextSchema.parse({
      type: 'company_invite',
      inviteId: '11111111-1111-4111-8111-111111111111',
      clinicName: 'Clinica Roma',
      role: 'medico',
      token: 'token-1',
    });

    expect(parsed.type).toBe('company_invite');
  });

  it('parses system message rows', () => {
    const parsed = messageRowSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      thread_id: '33333333-3333-4333-8333-333333333333',
      sender_id: '44444444-4444-4444-8444-444444444444',
      type: 'system',
      content: 'Sei stato invitato a unirti a Clinica Roma come medico',
      context: {
        type: 'company_invite',
        inviteId: '11111111-1111-4111-8111-111111111111',
        clinicName: 'Clinica Roma',
        role: 'medico',
        token: 'token-1',
      },
      read_by: [],
      created_at: '2026-06-25T10:00:00.000Z',
    });

    expect(parsed.type).toBe('system');
  });

  it('parses notification threads with unread count', () => {
    const parsed = notificationThreadSchema.parse({
      id: '33333333-3333-4333-8333-333333333333',
      participant_ids: ['44444444-4444-4444-8444-444444444444'],
      last_message: null,
      unread_count: 2,
      updated_at: '2026-06-25T10:00:00.000Z',
    });

    expect(parsed.unread_count).toBe(2);
  });
});

describe('consent notification contexts', () => {
  it('accepts consent FSM notification contexts', () => {
    expect(systemMessageContextSchema.parse({
      type: 'consent_awaiting_signature',
      consentId: '11111111-1111-4111-8111-111111111111',
      patientName: 'Ada Rossi',
      treatmentName: 'Laser',
    }).type).toBe('consent_awaiting_signature');

    expect(systemMessageContextSchema.parse({
      type: 'consent_awaiting_client_signature',
      consentId: '11111111-1111-4111-8111-111111111111',
      professionalName: 'Dott.ssa Bianchi',
      shareLink: 'https://bbw.example/consents/sign/token',
    }).type).toBe('consent_awaiting_client_signature');
  });
});

describe('booking notification contexts', () => {
  it('parses PPL invite and booking confirmation contexts', () => {
    expect(systemMessageContextSchema.parse({
      type: 'ppl_invite_received',
      inviteId: '11111111-1111-4111-8111-111111111111',
      professionalName: 'Dott.ssa Bianchi',
      clinicName: 'Clinica Centro',
    }).type).toBe('ppl_invite_received');

    expect(systemMessageContextSchema.parse({
      type: 'ppl_invite_accepted',
      inviteId: '22222222-2222-4222-8222-222222222222',
      patientName: 'Ada Rossi',
    }).type).toBe('ppl_invite_accepted');

    expect(systemMessageContextSchema.parse({
      type: 'appointment_confirmed',
      appointmentId: '33333333-3333-4333-8333-333333333333',
      date: '2026-07-01',
      professionalName: 'Dott.ssa Bianchi',
    }).type).toBe('appointment_confirmed');
  });
});
