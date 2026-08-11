import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260811000500_authoritative_onboarding_context.sql'), 'utf8');
const authorizationGrants = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260811000600_backend_authorization_read_grants.sql'), 'utf8');

describe('authoritative onboarding context migration', () => {
  it('locks onboarding state and grants the RPC only to the service role', () => {
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("INSERT INTO public.company_members (company_id, user_id, role, is_active)");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.complete_account_onboarding(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.complete_account_onboarding(UUID, TEXT, TEXT) TO service_role");
  });

  it('grants the backend only the read access needed for authorization context', () => {
    expect(authorizationGrants).toContain('GRANT SELECT ON TABLE public.companies, public.company_members TO service_role');
  });
});
