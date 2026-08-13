import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerUser } from '../../services/registration-service';

const previousNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = previousNodeEnv;
});

function validPayload() {
  return {
    email: 'person@example.com',
    password: 'Password!123',
    accept_terms: true as const,
    accept_privacy: true as const,
    consenso_marketing: false,
    consenso_profilazione: false,
  };
}

describe('canonical registration service', () => {
  it('creates a neutral account, consents and audit event only', async () => {
    process.env.NODE_ENV = 'test';
    const writes: Array<{ table: string; operation: string; payload: unknown }> = [];
    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const db = {
      auth: { admin: { createUser, deleteUser: vi.fn() } },
      from: vi.fn((table: string) => ({
        update: vi.fn((payload: unknown) => ({
          eq: vi.fn(async () => {
            writes.push({ table, operation: 'update', payload });
            return { error: null };
          }),
        })),
        insert: vi.fn(async (payload: unknown) => {
          writes.push({ table, operation: 'insert', payload });
          return { error: null };
        }),
        delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      })),
    } as any;

    await expect(registerUser(db, validPayload(), { ipAddress: '127.0.0.1' })).resolves.toEqual({ userId: 'user-1' });

    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'person@example.com',
      email_confirm: true,
    }));
    expect(writes.map((write) => write.table)).toEqual(['profiles', 'subjects', 'account_consents', 'audit_events']);
    expect(db.from).not.toHaveBeenCalledWith('users');
    expect(db.from).not.toHaveBeenCalledWith('companies');
  });

  it('maps duplicate Supabase accounts to a stable conflict error', async () => {
    process.env.NODE_ENV = 'test';
    const db = {
      auth: { admin: { createUser: vi.fn().mockResolvedValue({ data: {}, error: { message: 'User already registered' } }) } },
    } as any;

    await expect(registerUser(db, validPayload())).rejects.toMatchObject({
      details: { code: 'EMAIL_ALREADY_EXISTS', status: 409 },
    });
  });
});
