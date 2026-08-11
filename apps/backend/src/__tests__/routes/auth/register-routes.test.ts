import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRegisterHandler, createAvailabilityHandler } from '../../../routes/auth/register-routes';

describe('register routes', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });
  it('rejects privato with 422', async () => {
    const handler = createRegisterHandler({});
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler({
      body: {
        tipo_utente: 'privato',
        email: 'mario@example.com',
        password: 'Password123!',
        otp_reference: 'otp-ref',
        accept_terms: true,
        accept_privacy: true,
        consenso_marketing: true,
        consenso_profilazione: true,
      },
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns userId for a valid registration', async () => {
    const handler = createRegisterHandler({
      auth: { admin: { createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }), deleteUser: vi.fn() } },
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }), insert: vi.fn().mockResolvedValue({}) };
        }
        if (table === 'otps') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { reference: 'otp-ref', email: 'mario@example.com', purpose: 'registration', verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString() } }) };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }), insert: vi.fn().mockResolvedValue({}) };
      }),
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler({
      ip: '127.0.0.1',
      headers: {},
      get: vi.fn().mockReturnValue(undefined),
      body: {
        tipo_utente: 'cliente',
        email: 'mario@example.com',
        password: 'Password123!',
        otp_reference: 'otp-ref',
        accept_terms: true,
        accept_privacy: true,
        nome: 'Mario',
        cognome: 'Rossi',
        codice_fiscale: 'RSSMRA80A01H501U',
        consenso_marketing: true,
        consenso_profilazione: true,
      },
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('passes ip and user agent to registration service through metadata-backed db insert', async () => {
    const insertedConsents: unknown[] = [];
    const handler = createRegisterHandler({
      auth: { admin: { createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }), deleteUser: vi.fn() } },
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }), insert: vi.fn().mockResolvedValue({}) };
        }
        if (table === 'otps') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { reference: 'otp-ref', email: 'mario@example.com', purpose: 'registration', verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString() } }) };
        }
        if (table === 'user_consents') {
          return {
            insert: vi.fn((payload: unknown) => {
              insertedConsents.push(payload);
              return { error: undefined };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }), insert: vi.fn().mockResolvedValue({}) };
      }),
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler({
      ip: '127.0.0.1',
      headers: { 'user-agent': 'vitest-agent' },
      get: vi.fn((h: string) => h === 'user-agent' ? 'vitest-agent' : undefined),
      body: {
        tipo_utente: 'cliente',
        email: 'mario@example.com',
        password: 'Password123!',
        otp_reference: 'otp-ref',
        accept_terms: true,
        accept_privacy: true,
        nome: 'Mario',
        cognome: 'Rossi',
        codice_fiscale: 'RSSMRA80A01H501U',
        consenso_marketing: true,
        consenso_profilazione: true,
      },
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(insertedConsents[0]).toMatchObject({
      ip_address: '127.0.0.1',
      user_agent: 'vitest-agent',
    });
  });

  describe('availability', () => {
    it('reports available for unused email', async () => {
      const handler = createAvailabilityHandler({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      });
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler({
        body: { field: 'email', value: 'new@example.com' },
      } as never, res as never);

      expect(res.json).toHaveBeenCalledWith({ available: true });
    });

    it('reports unavailable for used email', async () => {
      const handler = createAvailabilityHandler({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'u1' } }),
        })),
      });
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler({
        body: { field: 'email', value: 'used@example.com' },
      } as never, res as never);

      expect(res.json).toHaveBeenCalledWith({ available: false });
    });

    it('returns 422 for invalid field', async () => {
      const handler = createAvailabilityHandler({} as never);
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler({
        body: { field: 'unknown', value: 'test' },
      } as never, res as never);

      expect(res.status).toHaveBeenCalledWith(422);
    });
  });
});
