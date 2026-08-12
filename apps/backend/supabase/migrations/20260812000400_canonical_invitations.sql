-- Canonical invitation metadata and acceptance ownership.
-- The raw acceptance token is never persisted: the backend stores only its hash.

alter table public.invitations
  add column invitee_first_name text,
  add column invitee_last_name text,
  add column accepted_by uuid references auth.users (id) on delete set null;

create unique index invitations_pending_email_unique
  on public.invitations (organization_id, lower(email))
  where status = 'pending';

create index invitations_token_status_idx
  on public.invitations (token_hash, status);

revoke all on public.invitations from anon, authenticated;
revoke all on public.invitations from service_role;
grant select, insert, update, delete on public.invitations to service_role;
