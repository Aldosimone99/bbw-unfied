import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../index';

function makeDb() {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    nome: 'Mario',
    cognome: 'Rossi',
    profile_slug: 'mario-rossi-k3x9',
    tipo_utente: 'medico',
    specializzazioni: ['Dermatologia'],
    bio: null,
    photo_url: null,
  };
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => {
        if (table === 'users') return { data: user, error: null };
        if (table === 'booking_settings') return { data: { online_booking_enabled: true }, error: null };
        return { data: null, error: null };
      }),
    })),
  } as any;
}

describe('users public routes', () => {
  it('returns public professional profile by slug', async () => {
    const response = await request(createApp(makeDb())).get('/users/profile/mario-rossi-k3x9');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      profile_slug: 'mario-rossi-k3x9',
      online_booking_enabled: true,
    });
  });
});
