-- Active organization membership, re-invitation reactivation and invitation history visibility.

alter table public.invitations
  add column hidden_from_history_at timestamptz,
  add column hidden_from_history_by uuid references auth.users (id) on delete set null;

create index invitations_organization_history_idx
  on public.invitations (organization_id, created_at desc)
  where hidden_from_history_at is null;

-- Revoked memberships and their role assignments must never be visible to an
-- authenticated account through direct table access.
drop policy if exists organization_members_select_own on public.organization_members;
create policy organization_members_select_own_active on public.organization_members
for select to authenticated using (
  user_id = (select auth.uid())
  and status = 'active'
);

drop policy if exists member_roles_select_own on public.member_roles;
create policy member_roles_select_own_active on public.member_roles
for select to authenticated using (
  exists (
    select 1
    from public.organization_members membership
    where membership.id = member_roles.organization_member_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
);

-- The operational member screen is intentionally active-only. Historical rows
-- remain in organization_members and audit_events, but are not members today.
drop function if exists public.list_organization_members(uuid);
create function public.list_organization_members(p_organization_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  status text,
  joined_at timestamptz,
  roles jsonb,
  is_organization_owner boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'ORGANIZATION_MEMBER_SERVICE_ROLE_REQUIRED';
  end if;

  return query
  select
    membership.id,
    membership.user_id,
    account.email::text,
    profile.first_name,
    profile.last_name,
    membership.status,
    membership.joined_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object('code', role_record.code, 'displayName', role_record.display_name)
        order by role_record.display_name
      ) filter (where role_record.id is not null),
      '[]'::jsonb
    ),
    coalesce(bool_or(role_record.code = 'organization_owner'), false)
  from public.organization_members membership
  join auth.users account on account.id = membership.user_id
  left join public.profiles profile on profile.user_id = membership.user_id
  left join public.member_roles member_role on member_role.organization_member_id = membership.id
  left join public.roles role_record on role_record.id = member_role.role_id and role_record.scope = 'organization'
  where membership.organization_id = p_organization_id
    and membership.status = 'active'
  group by membership.id, membership.user_id, account.email, profile.first_name, profile.last_name, membership.status, membership.joined_at
  order by membership.joined_at asc nulls last, account.email asc;
end;
$$;

-- An accepted invitation can reactivate only a revoked canonical membership.
-- The unique (organization_id, user_id) constraint therefore remains the source
-- of truth and no duplicate membership or role assignment can be introduced.
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
  membership_reactivated boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  if p_user_id is null or btrim(coalesce(p_token_hash, '')) = '' then
    raise exception 'INVITATION_INVALID_INPUT';
  end if;

  select * into invitation_record
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

  select lower(btrim(email)) into invited_user_email
  from auth.users
  where id = p_user_id;
  if invited_user_email is null then
    raise exception 'INVITATION_USER_NOT_FOUND';
  end if;
  if invited_user_email <> lower(btrim(invitation_record.email)) then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  select (status = 'active') into organization_is_active
  from public.organizations
  where id = invitation_record.organization_id;
  if organization_is_active is distinct from true then
    raise exception 'INVITATION_ORGANIZATION_NOT_ACTIVE';
  end if;

  select code into assigned_role_code
  from public.roles
  where id = invitation_record.role_id
    and scope = 'organization'
    and is_active;
  if assigned_role_code is null then
    raise exception 'INVITATION_ROLE_NOT_CONFIGURED';
  end if;

  select id, status into membership_id, membership_status
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
      'already_member', true,
      'membership_reactivated', false
    );
  end if;

  if membership_id is null then
    insert into public.organization_members (organization_id, user_id, status, joined_at)
    values (invitation_record.organization_id, p_user_id, 'active', timezone('utc', now()))
    returning id into membership_id;
  elsif membership_status = 'revoked' then
    update public.organization_members
    set status = 'active', joined_at = timezone('utc', now())
    where id = membership_id;
    membership_reactivated := true;
    delete from public.member_roles where organization_member_id = membership_id;
  else
    raise exception 'MEMBERSHIP_ALREADY_EXISTS';
  end if;

  insert into public.member_roles (organization_member_id, role_id)
  values (membership_id, invitation_record.role_id)
  on conflict (organization_member_id, role_id) do nothing;

  update public.invitations
  set status = 'accepted', accepted_by = p_user_id, accepted_at = timezone('utc', now())
  where id = invitation_record.id;

  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values
    (
      p_user_id,
      invitation_record.organization_id,
      case when membership_reactivated then 'organization.membership.reactivated' else 'organization.membership.created' end,
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
      jsonb_build_object('role', assigned_role_code, 'membership_reactivated', membership_reactivated)
    );

  return jsonb_build_object(
    'organization_id', invitation_record.organization_id,
    'role_code', assigned_role_code,
    'already_member', false,
    'membership_reactivated', membership_reactivated
  );
end;
$$;

create or replace function public.hide_organization_invitation_from_history(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  invitation_status text;
  invitation_expires_at timestamptz;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  select status, expires_at into invitation_status, invitation_expires_at
  from public.invitations
  where id = p_invitation_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;
  if invitation_status = 'pending' and invitation_expires_at <= timezone('utc', now()) then
    update public.invitations set status = 'expired' where id = p_invitation_id;
    invitation_status := 'expired';
  end if;
  if invitation_status = 'pending' then
    raise exception 'INVITATION_PENDING_HISTORY_HIDE_NOT_ALLOWED';
  end if;

  update public.invitations
  set hidden_from_history_at = timezone('utc', now()), hidden_from_history_by = p_actor_user_id
  where id = p_invitation_id;

  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, p_organization_id, 'organization.invitation.history_hidden', 'invitation', p_invitation_id, '{}'::jsonb);
end;
$$;

create or replace function public.clear_organization_invitation_history(
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  hidden_count integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  update public.invitations
  set status = 'expired'
  where organization_id = p_organization_id
    and status = 'pending'
    and expires_at <= timezone('utc', now());

  with hidden as (
    update public.invitations
    set hidden_from_history_at = timezone('utc', now()), hidden_from_history_by = p_actor_user_id
    where organization_id = p_organization_id
      and hidden_from_history_at is null
      and status in ('accepted', 'revoked', 'expired')
    returning id
  )
  select count(*) into hidden_count from hidden;

  if hidden_count > 0 then
    insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
    values (
      p_actor_user_id,
      p_organization_id,
      'organization.invitation.history_cleared',
      'invitation_history',
      null,
      jsonb_build_object('hidden_count', hidden_count)
    );
  end if;

  return hidden_count;
end;
$$;

revoke all on function public.list_organization_members(uuid) from public, anon, authenticated;
revoke all on function public.accept_organization_invitation(text, uuid) from public, anon, authenticated;
revoke all on function public.hide_organization_invitation_from_history(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.clear_organization_invitation_history(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_organization_members(uuid) to service_role;
grant execute on function public.accept_organization_invitation(text, uuid) to service_role;
grant execute on function public.hide_organization_invitation_from_history(uuid, uuid, uuid) to service_role;
grant execute on function public.clear_organization_invitation_history(uuid, uuid) to service_role;
