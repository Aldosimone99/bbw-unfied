import { describe, expect, it } from 'vitest';
import {
  chatContactSchema,
  chatThreadListResponseSchema,
  chatThreadSchema,
  sendMessageRequestSchema,
  startThreadRequestSchema,
} from '../../schemas/chat-schema';

describe('chat schemas', () => {
  it('validates send message payloads', () => {
    expect(sendMessageRequestSchema.parse({ content: 'Ciao' })).toEqual({ content: 'Ciao' });
    expect(() => sendMessageRequestSchema.parse({ content: '' })).toThrow();
  });

  it('validates start thread payloads', () => {
    expect(startThreadRequestSchema.parse({
      recipientId: '11111111-1111-4111-8111-111111111111',
    }).recipientId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('parses chat contacts and threads', () => {
    const contact = chatContactSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      nome: 'Mario',
      cognome: 'Rossi',
      tipo_utente: 'cliente',
      avatar_url: null,
    });

    const thread = chatThreadSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      participant_ids: ['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'],
      other_participant: contact,
      last_message: null,
      unread_count: 0,
      updated_at: '2026-06-25T10:00:00.000Z',
    });

    expect(chatThreadListResponseSchema.parse({
      data: [thread],
      total: 1,
      page: 1,
      limit: 20,
      pages: 1,
    }).data[0].other_participant.nome).toBe('Mario');
  });
});
