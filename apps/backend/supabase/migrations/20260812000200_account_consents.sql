-- Account-level legal and communication consents.

create table public.account_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  consent_type text not null,
  accepted boolean not null,
  version text not null,
  ip_address inet,
  user_agent text,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint account_consents_type_check check (
    consent_type in ('terms', 'privacy', 'marketing', 'profiling')
  ),
  constraint account_consents_version_check check (btrim(version) <> ''),
  constraint account_consents_accepted_at_check check (
    accepted = false or accepted_at is not null
  ),
  constraint account_consents_unique_version unique (user_id, consent_type, version)
);

create index account_consents_user_idx on public.account_consents (user_id, consent_type);
alter table public.account_consents enable row level security;

create policy account_consents_select_own on public.account_consents
for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.account_consents from anon, authenticated;
grant select on public.account_consents to authenticated;
grant select, insert on public.account_consents to service_role;
