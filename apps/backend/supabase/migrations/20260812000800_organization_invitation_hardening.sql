-- Invitation role-assignment policy and hardened atomic acceptance.
-- The browser never supplies an authoritative organization, inviter or permission.

create table public.organization_role_assignment_rules (
  assigner_role_id uuid not null references public.roles (id) on delete cascade,
  target_role_id uuid not null references public.roles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (assigner_role_id, target_role_id),
  constraint organization_role_assignment_rules_not_self check (assigner_role_id <> target_role_id)
);

create index organization_role_assignment_rules_target_idx
  on public.organization_role_assignment_rules (target_role_id);

alter table public.organization_role_assignment_rules enable row level security;

revoke all on public.organization_role_assignment_rules from public, anon, authenticated;
grant select, insert, update, delete on public.organization_role_assignment_rules to service_role;

with assignment_rules (assigner_code, target_code) as (
  values
    ('organization_owner', 'organization_admin'),
    ('organization_owner', 'clinical_director'),
    ('organization_owner', 'practitioner'),
    ('organization_owner', 'office_manager'),
    ('organization_owner', 'finance'),
    ('organization_owner', 'staff'),
    ('organization_owner', 'customer'),
    ('organization_admin', 'clinical_director'),
    ('organization_admin', 'practitioner'),
    ('organization_admin', 'office_manager'),
    ('organization_admin', 'finance'),
    ('organization_admin', 'staff'),
    ('organization_admin', 'customer')
)
insert into public.organization_role_assignment_rules (assigner_role_id, target_role_id)
select assigner_role.id, target_role.id
from assignment_rules
join public.roles assigner_role on assigner_role.code = assignment_rules.assigner_code
join public.roles target_role on target_role.code = assignment_rules.target_code
where assigner_role.scope = 'organization'
  and target_role.scope = 'organization'
on conflict (assigner_role_id, target_role_id) do nothing;

create or replace function public.accept_organization_invitation(
  p_token_hash text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  invitation_record public.invitations%rowtype;
  invited_user_email text;
  membership_id uuid;
  membership_status text;
  assigned_role_code text;
  organization_is_active boolean;
  was_already_accepted boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  if p_user_id is null or btrim(coalesce(p_token_hash, '')) = '' then
    raise exception 'INVITATION_INVALID_INPUT';
  end if;

  select *
  into invitation_record
  from public.invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  if invitation_record.status = 'accepted' then
    if invitation_record.accepted_by is distinct from p_user_id then
      raise exception 'INVITATION_ALREADY_ACCEPTED';
    end if;
    was_already_accepted := true;
  elsif invitation_record.status = 'revoked' then
    raise exception 'INVITATION_REVOKED';
  elsif invitation_record.status = 'expired' or invitation_record.expires_at <= timezone('utc', now()) then
    raise exception 'INVITATION_EXPIRED';
  elsif invitation_record.status <> 'pending' then
    raise exception 'INVITATION_NOT_PENDING';
  end if;

  select lower(btrim(email))
  into invited_user_email
  from auth.users
  where id = p_user_id;

  if invited_user_email is null then
    raise exception 'INVITATION_USER_NOT_FOUND';
  end if;

  if invited_user_email <> lower(btrim(invitation_record.email)) then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  select (status = 'active')
  into organization_is_active
  from public.organizations
  where id = invitation_record.organization_id;

  if organization_is_active is distinct from true then
    raise exception 'INVITATION_ORGANIZATION_NOT_ACTIVE';
  end if;

  select code
  into assigned_role_code
  from public.roles
  where id = invitation_record.role_id
    and scope = 'organization'
    and is_active;

  if assigned_role_code is null then
    raise exception 'INVITATION_ROLE_NOT_CONFIGURED';
  end if;

  select id, status
  into membership_id, membership_status
  from public.organization_members
  where organization_id = invitation_record.organization_id
    and user_id = p_user_id
  for update;

  if was_already_accepted then
    if membership_id is null or membership_status <> 'active' then
      raise exception 'MEMBERSHIP_NOT_ACTIVE';
    end if;

    return jsonb_build_object(
      'organization_id', invitation_record.organization_id,
      'role_code', assigned_role_code,
      'already_member', true
    );
  end if;

  if membership_id is not null then
    raise exception 'MEMBERSHIP_ALREADY_EXISTS';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    status,
    joined_at
  )
  values (
    invitation_record.organization_id,
    p_user_id,
    'active',
    timezone('utc', now())
  )
  returning id into membership_id;

  insert into public.member_roles (organization_member_id, role_id)
  values (membership_id, invitation_record.role_id);

  update public.invitations
  set
    status = 'accepted',
    accepted_by = p_user_id,
    accepted_at = timezone('utc', now())
  where id = invitation_record.id;

  insert into public.audit_events (
    actor_user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values
    (
      p_user_id,
      invitation_record.organization_id,
      'organization.membership.created',
      'organization_membership',
      membership_id,
      jsonb_build_object('role', assigned_role_code, 'source', 'organization_invitation')
    ),
    (
      p_user_id,
      invitation_record.organization_id,
      'organization.invitation.accepted',
      'invitation',
      invitation_record.id,
      jsonb_build_object('role', assigned_role_code)
    );

  return jsonb_build_object(
    'organization_id', invitation_record.organization_id,
    'role_code', assigned_role_code,
    'already_member', false
  );
end;
$$;

revoke all on function public.accept_organization_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_organization_invitation(text, uuid) to service_role;
