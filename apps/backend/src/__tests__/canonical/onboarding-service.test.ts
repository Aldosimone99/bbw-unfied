import { describe, expect, it, vi } from 'vitest';
import { completeAccountOnboarding, saveAccountProfile } from '../../services/account-onboarding-service';

describe('canonical onboarding service', () => {
  it('persists the personal profile before contextual onboarding', async () => {
    const profileQuery: any = {
      select: vi.fn(() => profileQuery),
      eq: vi.fn(() => profileQuery),
      single: vi.fn(async () => ({ data: { user_id: 'user-1', onboarding_status: 'profile_required' }, error: null })),
      update: vi.fn((payload: unknown) => ({
        eq: vi.fn(async () => ({ data: payload, error: null })),
      })),
    };
    const db = { from: vi.fn(() => profileQuery) } as any;

    await saveAccountProfile(db, 'user-1', { nome: 'Mario', cognome: 'Rossi', telefono: '+3900000000' });

    expect(profileQuery.update).toHaveBeenCalledWith({
      first_name: 'Mario',
      last_name: 'Rossi',
      phone: '+3900000000',
      onboarding_status: 'context_required',
    });
  });

  it('delegates organization creation to the service-role-only transaction', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { organization_id: 'organization-1' }, error: null });
    const result = await completeAccountOnboarding({ rpc } as any, 'user-1', {
      account_type: 'organization',
      organization_display_name: 'Clinica Roma',
    });
    expect(result).toEqual({ organizationId: 'organization-1' });
    expect(rpc).toHaveBeenCalledWith('complete_account_onboarding', {
      p_user_id: 'user-1',
      p_account_type: 'organization',
      p_organization_display_name: 'Clinica Roma',
    });
  });
});
