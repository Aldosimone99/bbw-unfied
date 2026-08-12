import { describe, expect, it, vi } from 'vitest';
import { login } from '../../services/login-service';

function profileBuilder() {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({
      data: { user_id: 'user-1', first_name: 'Mario', last_name: 'Rossi' },
      error: null,
    })),
  };
  return builder;
}

function roleBuilder() {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(async () => ({ data: [], error: null })),
  };
  return builder;
}

describe('canonical login service', () => {
  it('authenticates by email and returns a sanitized compatibility user', async () => {
    const db = {
      from: vi.fn((table: string) => table === 'profiles' ? profileBuilder() : roleBuilder()),
    } as any;
    const authClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-1', email: 'person@example.com' },
            session: { access_token: 'access', refresh_token: 'refresh' },
          },
          error: null,
        }),
      },
    } as any;
    const rateLimitFn = vi.fn().mockResolvedValue(undefined);

    const result = await login(
      db,
      { email: 'person@example.com', password: 'Password!123' },
      { ip: '127.0.0.1' },
      async () => false,
      authClient,
      rateLimitFn as any,
    );

    expect(result).toEqual({
      success: true,
      user: {
        id: 'user-1',
        email: 'person@example.com',
        tipo_utente: 'privato',
        nome: 'Mario',
        cognome: 'Rossi',
      },
      token: 'access',
      refreshToken: 'refresh',
    });
    expect(rateLimitFn).toHaveBeenCalledTimes(2);
  });

  it('does not accept codice fiscale as an authentication identifier', async () => {
    const result = await login(
      {} as any,
      { codiceFiscale: 'RSSMRA80A01H501U', password: 'Password!123' },
      { ip: '127.0.0.1' },
      async () => false,
      {} as any,
      vi.fn().mockResolvedValue(undefined) as any,
    );
    expect(result).toEqual({ success: false, status: 401, code: 'INVALID_CREDENTIALS' });
  });
});
