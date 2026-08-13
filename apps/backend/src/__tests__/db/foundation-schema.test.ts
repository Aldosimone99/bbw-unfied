import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationRoot = resolve(process.cwd(), 'supabase/migrations');
const foundation = readFileSync(resolve(migrationRoot, '20260812000000_foundation_identity_authorization.sql'), 'utf8');
const onboarding = readFileSync(resolve(migrationRoot, '20260812000100_account_onboarding_rpc.sql'), 'utf8');
const consents = readFileSync(resolve(migrationRoot, '20260812000200_account_consents.sql'), 'utf8');
const rls = readFileSync(resolve(migrationRoot, '20260812000300_rls_policy_hardening.sql'), 'utf8');
const invitations = readFileSync(resolve(migrationRoot, '20260812000400_canonical_invitations.sql'), 'utf8');
const invitationAcceptance = readFileSync(resolve(migrationRoot, '20260812000500_accept_invitation_transaction.sql'), 'utf8');
const readiness = readFileSync(resolve(migrationRoot, '20260812000600_operational_readiness_profile_data.sql'), 'utf8');
const readinessAuditTransactions = readFileSync(resolve(migrationRoot, '20260812000700_profile_update_audit_transactions.sql'), 'utf8');
const invitationHardening = readFileSync(resolve(migrationRoot, '20260812000800_organization_invitation_hardening.sql'), 'utf8');
const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8');

describe('canonical foundation schema', () => {
  it('defines the normalized identity and organization graph', () => {
    for (const table of [
      'profiles',
      'organizations',
      'organization_members',
      'roles',
      'permissions',
      'role_permissions',
      'member_roles',
      'account_roles',
      'professional_types',
      'professional_profiles',
      'subjects',
      'invitations',
      'audit_events',
    ]) {
      expect(foundation).toContain(`create table public.${table}`);
    }
  });

  it('does not reintroduce legacy identity tables into the active baseline', () => {
    expect(foundation).not.toMatch(/create table public\.(users|companies|company_members)/);
    expect(foundation).toContain('alter table public.profiles enable row level security');
    expect(foundation).toContain('alter table public.organization_members enable row level security');
  });

  it('protects onboarding with a service-role-only transaction', () => {
    expect(onboarding).toContain("if (select auth.role()) <> 'service_role'");
    expect(onboarding).toContain('insert into public.organization_members');
    expect(onboarding).toContain('insert into public.member_roles');
    expect(onboarding).toContain('revoke all on function public.complete_account_onboarding');
  });

  it('stores legal and communication consents separately', () => {
    expect(consents).toContain('create table public.account_consents');
    expect(consents).toContain("'terms', 'privacy', 'marketing', 'profiling'");
    expect(consents).toContain('account_consents_unique_version');
  });

  it('keeps membership RLS non-recursive', () => {
    expect(rls).toContain('drop policy if exists organization_members_select_same_org');
    expect(seed).toContain("('physician', 'healthcare'");
    expect(seed).toContain("('beauty_professional', 'beauty'");
    expect(seed).toContain("('accountant', 'business'");
    expect(seed).toContain("('organization_owner', 'Organization owner'");
  });

  it('keeps invitation tokens hashed and professionals type-driven', () => {
    expect(invitations).toContain('token_hash');
    expect(invitations).toContain('accepted_by');
    expect(invitations).toContain('invitations_pending_email_unique');
    expect(seed).toContain("('customer', 'Customer', 'organization', true)");
  });

  it('adds source data for derived readiness without a persisted completion flag', () => {
    expect(readiness).toContain('add column birth_date date');
    expect(readiness).toContain('add column tax_code text');
    expect(readiness).toContain('add column residential_address jsonb');
    expect(readiness).toContain('add column tax_identifier text');
    expect(readiness).toContain('add column registered_address jsonb');
    expect(readiness).not.toMatch(/profile_completed|operational_readiness\s+boolean/i);
  });

  it('keeps sensitive updates and their minimized audit events in service-role-only transactions', () => {
    expect(readinessAuditTransactions).toContain('update_personal_profile_with_audit');
    expect(readinessAuditTransactions).toContain('update_organization_profile_with_audit');
    expect(readinessAuditTransactions).toContain("if (select auth.role()) <> 'service_role'");
    expect(readinessAuditTransactions).toContain("jsonb_build_object('changed_fields', changed_fields)");
    expect(readinessAuditTransactions).toContain('grant execute on function public.update_personal_profile_with_audit');
  });

  it('keeps invitation role assignment and acceptance hardened without permissive RLS', () => {
    expect(invitationHardening).toContain('create table public.organization_role_assignment_rules');
    expect(invitationHardening).toContain('grant select, insert, update, delete on public.organization_role_assignment_rules to service_role');
    expect(invitationHardening).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(invitationHardening).toContain('INVITATION_REVOKED');
    expect(invitationHardening).toContain('MEMBERSHIP_ALREADY_EXISTS');
    expect(invitationHardening).toContain("'organization.membership.created'");
    expect(invitationHardening).toContain("'organization.invitation.accepted'");
  });

  it('accepts invitations in a locked service-role-only transaction', () => {
    expect(invitationAcceptance).toContain('for update');
    expect(invitationAcceptance).toContain("if (select auth.role()) <> 'service_role'");
    expect(invitationAcceptance).toContain('insert into public.organization_members');
    expect(invitationAcceptance).toContain('insert into public.member_roles');
    expect(invitationAcceptance).toContain('INVITATION_EMAIL_MISMATCH');
    expect(invitationAcceptance).toContain('revoke all on function public.accept_organization_invitation');
  });
});
