import { describe, expect, it, vi } from 'vitest';
import { AccountOnboardingError, completeAccountOnboarding } from '../../services/account-onboarding-service';

function makeDb(result: { data?: unknown; error?: { message: string } | null }) {
  return { rpc: vi.fn().mockResolvedValue(result) };
}

describe('completeAccountOnboarding', () => {
  it('delegates completion to the transactional backend RPC without granting a role', async () => {
    const db = makeDb({ data: { company_id: null }, error: null });

    const result = await completeAccountOnboarding(db, 'user-1', {
      account_type: 'personal',
    });

    expect(result).toEqual({ companyId: null });
    expect(db.rpc).toHaveBeenCalledWith('complete_account_onboarding', {
      p_user_id: 'user-1',
      p_account_type: 'personal',
      p_organization_display_name: null,
    });
  });

  it('returns the atomically created company for an organization account', async () => {
    const db = makeDb({ data: { company_id: 'company-1' }, error: null });

    await expect(completeAccountOnboarding(db, 'user-1', {
      account_type: 'organization',
      organization_display_name: 'Clinica BBW',
    })).resolves.toEqual({ companyId: 'company-1' });
  });

  it('maps concurrency and missing-user failures to stable API errors', async () => {
    const db = makeDb({ data: null, error: { message: 'ONBOARDING_ALREADY_COMPLETED' } });
    await expect(completeAccountOnboarding(db, 'user-1', { account_type: 'personal' }))
      .rejects.toBeInstanceOf(AccountOnboardingError);
    await expect(completeAccountOnboarding(db, 'user-1', { account_type: 'personal' }))
      .rejects.toMatchObject({ code: 'ONBOARDING_ALREADY_COMPLETED' });
  });
});
