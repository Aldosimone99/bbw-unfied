import { describe, expect, it, vi } from 'vitest';
import { updateCurrentUserProfile } from '../../services/profile-service';

describe('updateCurrentUserProfile', () => {
  it('routes address fields to user_addresses', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'user_addresses') return { upsert };
        if (table === 'users') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: {} }) };
        return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({}) };
      }),
    };

    await updateCurrentUserProfile(db, { id: 'u1', email: 'u@example.com', tipo_utente: 'cliente' }, { citta: 'Milano' });

    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1', citta: 'Milano' });
  });

  it('returns a 403-style error when cliente sends studio fields', async () => {
    await expect(updateCurrentUserProfile(
      { from: vi.fn() },
      { id: 'u1', email: 'u@example.com', tipo_utente: 'cliente' },
      { studio_citta: 'Roma' },
    )).rejects.toMatchObject({ status: 403 });
  });
});
