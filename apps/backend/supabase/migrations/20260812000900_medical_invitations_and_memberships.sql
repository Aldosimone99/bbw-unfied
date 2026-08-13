-- Medical-only organization invitations and canonical organization-member management.

create or replace function public.enforce_medical_organization_invitation_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  invitation_role_code text;
begin
  if new.status <> 'accepted' or old.status = 'accepted' then
    return new;
  end if;

  select code
  into invitation_role_code
  from public.roles
  where id = new.role_id
    and scope = 'organization'
    and is_active;

  if invitation_role_code is distinct from 'practitioner' then
    raise exception 'INVITATION_ROLE_NOT_MEDICAL';
  end if;

  if new.accepted_by is null or not exists (
    select 1
    from public.professional_profiles professional_profile
    join public.professional_types professional_type
      on professional_type.id = professional_profile.professional_type_id
    where professional_profile.user_id = new.accepted_by
      and professional_type.code = 'physician'
      and professional_type.is_active
      and professional_profile.verification_status = 'verified'
  ) then
    raise exception 'INVITATION_RECIPIENT_NOT_PHYSICIAN';
  end if;

  return new;
end;
$$;

drop trigger if exists invitations_medical_acceptance_validation on public.invitations;
create trigger invitations_medical_acceptance_validation
before update of status, accepted_by on public.invitations
for each row execute function public.enforce_medical_organization_invitation_acceptance();

create or replace function public.list_organization_members(p_organization_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  status text,
  joined_at timestamptz,
  roles jsonb
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
    )
  from public.organization_members membership
  join auth.users account on account.id = membership.user_id
  left join public.profiles profile on profile.user_id = membership.user_id
  left join public.member_roles member_role on member_role.organization_member_id = membership.id
  left join public.roles role_record on role_record.id = member_role.role_id and role_record.scope = 'organization'
  where membership.organization_id = p_organization_id
  group by membership.id, membership.user_id, account.email, profile.first_name, profile.last_name, membership.status, membership.joined_at
  order by membership.joined_at asc nulls last, account.email asc;
end;
$$;

create or replace function public.remove_organization_member(
  p_organization_id uuid,
  p_membership_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  target_membership public.organization_members%rowtype;
  active_owner_count integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'ORGANIZATION_MEMBER_SERVICE_ROLE_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));

  select *
  into target_membership
  from public.organization_members
  where id = p_membership_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'ORGANIZATION_MEMBER_NOT_FOUND';
  end if;

  if target_membership.user_id = p_actor_user_id then
    raise exception 'ORGANIZATION_MEMBER_SELF_REMOVAL_NOT_ALLOWED';
  end if;

  if target_membership.status <> 'active' then
    raise exception 'ORGANIZATION_MEMBER_NOT_ACTIVE';
  end if;

  if exists (
    select 1
    from public.member_roles target_role_assignment
    join public.roles target_role on target_role.id = target_role_assignment.role_id
    where target_role_assignment.organization_member_id = target_membership.id
      and target_role.code = 'organization_owner'
  ) then
    with locked_active_owner_memberships as (
      select owner_membership.id
      from public.organization_members owner_membership
      join public.member_roles owner_role_assignment on owner_role_assignment.organization_member_id = owner_membership.id
      join public.roles owner_role on owner_role.id = owner_role_assignment.role_id
      where owner_membership.organization_id = p_organization_id
        and owner_membership.status = 'active'
        and owner_role.code = 'organization_owner'
      for update of owner_membership
    )
    select count(*) into active_owner_count
    from locked_active_owner_memberships;

    if active_owner_count <= 1 then
      raise exception 'ORGANIZATION_LAST_OWNER_REMOVAL_NOT_ALLOWED';
    end if;
  end if;

  update public.organization_members
  set status = 'revoked'
  where id = target_membership.id;

  insert into public.audit_events (
    actor_user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    p_actor_user_id,
    p_organization_id,
    'organization.membership.revoked',
    'organization_membership',
    target_membership.id,
    jsonb_build_object('removed_user_id', target_membership.user_id)
  );

  return jsonb_build_object('membership_id', target_membership.id, 'status', 'revoked');
end;
$$;

revoke all on function public.list_organization_members(uuid) from public, anon, authenticated;
revoke all on function public.remove_organization_member(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_organization_members(uuid) to service_role;
grant execute on function public.remove_organization_member(uuid, uuid, uuid) to service_role;
