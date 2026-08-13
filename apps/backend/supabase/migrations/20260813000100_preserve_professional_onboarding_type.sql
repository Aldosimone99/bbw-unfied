-- Preserve the selected professional type during onboarding so medical invitations
-- can identify physician accounts from canonical professional profiles.

alter table public.profiles
drop constraint if exists profiles_onboarding_intent_check;

alter table public.profiles
add constraint profiles_onboarding_intent_check check (
  onboarding_intent is null
  or onboarding_intent in (
    'personal',
    'professional',
    'healthcare_professional',
    'beauty_professional',
    'organization',
    'commercial'
  )
);

create or replace function public.complete_account_onboarding(
  p_user_id uuid,
  p_account_type text,
  p_organization_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  current_status text;
  normalized_type text;
  professional_type_code text;
  v_professional_type_id uuid;
  organization_id uuid;
  membership_id uuid;
  account_holder_role_id uuid;
  organization_owner_role_id uuid;
  clinic_type_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'ONBOARDING_SERVICE_ROLE_REQUIRED';
  end if;

  normalized_type := case p_account_type
    when 'personal' then 'personal'
    when 'healthcare_professional' then 'healthcare_professional'
    when 'beauty_professional' then 'beauty_professional'
    when 'professional' then 'professional'
    when 'organization' then 'organization'
    when 'commercial' then 'commercial'
    when 'commercial_partner' then 'commercial'
    else null
  end;

  professional_type_code := case p_account_type
    when 'healthcare_professional' then 'physician'
    when 'beauty_professional' then 'beauty_professional'
    else null
  end;

  if normalized_type is null then
    raise exception 'ONBOARDING_ACCOUNT_TYPE_INVALID';
  end if;

  select onboarding_status into current_status
  from public.profiles
  where user_id = p_user_id
  for update;

  if current_status is null then
    raise exception 'ONBOARDING_NOT_FOUND';
  end if;
  if current_status = 'completed' then
    raise exception 'ONBOARDING_ALREADY_COMPLETED';
  end if;

  select id into account_holder_role_id
  from public.roles
  where code = 'account_holder' and scope = 'platform' and is_active;

  if account_holder_role_id is null then
    raise exception 'ONBOARDING_BASE_ROLE_MISSING';
  end if;

  insert into public.account_roles (user_id, role_id)
  values (p_user_id, account_holder_role_id)
  on conflict (user_id, role_id) do nothing;

  if professional_type_code is not null then
    select id into v_professional_type_id
    from public.professional_types
    where code = professional_type_code and is_active;

    if v_professional_type_id is null then
      raise exception 'ONBOARDING_PROFESSIONAL_TYPE_MISSING';
    end if;

    insert into public.professional_profiles (
      user_id,
      professional_type_id,
      verification_status
    )
    values (
      p_user_id,
      v_professional_type_id,
      'draft'
    )
    on conflict (user_id, professional_type_id) do nothing;
  end if;

  if normalized_type = 'organization' then
    if btrim(coalesce(p_organization_display_name, '')) = '' then
      raise exception 'ONBOARDING_ORGANIZATION_NAME_REQUIRED';
    end if;

    select id into clinic_type_id
    from public.organization_types
    where code = 'clinic' and is_active;

    if clinic_type_id is null then
      raise exception 'ONBOARDING_ORGANIZATION_TYPE_MISSING';
    end if;

    insert into public.organizations (
      organization_type_id,
      display_name,
      created_by,
      status
    )
    values (
      clinic_type_id,
      btrim(p_organization_display_name),
      p_user_id,
      'active'
    )
    returning id into organization_id;

    insert into public.organization_members (
      organization_id,
      user_id,
      status,
      joined_at
    )
    values (organization_id, p_user_id, 'active', timezone('utc', now()))
    returning id into membership_id;

    select id into organization_owner_role_id
    from public.roles
    where code = 'organization_owner' and scope = 'organization' and is_active;

    if organization_owner_role_id is null then
      raise exception 'ONBOARDING_OWNER_ROLE_MISSING';
    end if;

    insert into public.member_roles (organization_member_id, role_id)
    values (membership_id, organization_owner_role_id);
  end if;

  update public.profiles
  set onboarding_intent = normalized_type,
      onboarding_status = 'completed',
      updated_at = timezone('utc', now())
  where user_id = p_user_id;

  return jsonb_build_object('organization_id', organization_id);
end;
$$;

revoke all on function public.complete_account_onboarding(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.complete_account_onboarding(uuid, text, text)
to service_role;

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
      and professional_profile.verification_status in ('draft', 'pending', 'verified')
  ) then
    raise exception 'INVITATION_RECIPIENT_NOT_PHYSICIAN';
  end if;

  return new;
end;
$$;

-- Accounts completed before the type-preserving RPC existed only carry the
-- generic professional intent. Backfill their missing canonical profile so
-- the existing medical onboarding choice remains usable after migration.
insert into public.professional_profiles (user_id, professional_type_id, verification_status)
select profile.user_id, professional_type.id, 'draft'
from public.profiles profile
join public.professional_types professional_type
  on professional_type.code = 'physician'
  and professional_type.is_active
where profile.onboarding_intent = 'professional'
  and not exists (
    select 1
    from public.professional_profiles existing_profile
    where existing_profile.user_id = profile.user_id
  )
on conflict (user_id, professional_type_id) do nothing;
