import { describe, expect, it, vi } from 'vitest';
import { updateCurrentUserProfile } from '../../services/profile-service';

const profileRow = {
  user_id: 'user-1',
  first_name: 'Mario',
  last_name: 'Rossi',
  phone: null,
  birth_date: '1990-01-01',
  tax_code: 'RSSMRA90A01H501U',
  residential_address: { street: 'Via Roma 1', city: 'Milano', postal_code: '20100', country_code: 'IT' },
  onboarding_intent: 'personal',
  onboarding_status: 'completed',
  created_at: '2026-08-12T10:00:00.000Z',
  updated_at: '2026-08-12T10:00:00.000Z',
};

function profileReader() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
  };
}

describe('updateCurrentUserProfile', () => {
  it('uses the verified account identifier and atomic audit RPC without passing values as audit metadata', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const db = {
      rpc,
      from: vi.fn(() => profileReader()),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'mario@example.com' } } }) } },
    };

    await updateCurrentUserProfile(db, { id: 'verified-user-id', email: 'mario@example.com', tipo_utente: 'privato' }, {
      tax_code: 'RSSMRA90A01H501U',
      address: { street: 'Via Roma 1', city: 'Milano', postal_code: '20100', country_code: 'IT' },
    });

    expect(rpc).toHaveBeenCalledWith('update_personal_profile_with_audit', {
      p_user_id: 'verified-user-id',
      p_updates: {
        tax_code: 'RSSMRA90A01H501U',
        address: { street: 'Via Roma 1', city: 'Milano', postal_code: '20100', country_code: 'IT' },
      },
    });
  });
});
