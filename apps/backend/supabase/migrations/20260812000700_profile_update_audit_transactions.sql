-- Keep sensitive profile changes and their minimal audit event in one transaction.
-- The trusted backend validates payloads with Zod before calling these functions.

create or replace function public.update_personal_profile_with_audit(
  p_user_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  changed_fields jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PROFILE_SERVICE_ROLE_REQUIRED';
  end if;

  if p_user_id is null or p_updates is null or jsonb_typeof(p_updates) <> 'object' or p_updates = '{}'::jsonb then
    raise exception 'PROFILE_UPDATE_INVALID_INPUT';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as key
    where key not in ('first_name', 'last_name', 'phone', 'birth_date', 'tax_code', 'address')
  ) then
    raise exception 'PROFILE_UPDATE_FIELD_FORBIDDEN';
  end if;

  update public.profiles
  set
    first_name = case when p_updates ? 'first_name' then nullif(btrim(p_updates ->> 'first_name'), '') else first_name end,
    last_name = case when p_updates ? 'last_name' then nullif(btrim(p_updates ->> 'last_name'), '') else last_name end,
    phone = case when p_updates ? 'phone' then nullif(btrim(p_updates ->> 'phone'), '') else phone end,
    birth_date = case when p_updates ? 'birth_date' then nullif(p_updates ->> 'birth_date', '')::date else birth_date end,
    tax_code = case when p_updates ? 'tax_code' then nullif(btrim(p_updates ->> 'tax_code'), '') else tax_code end,
    residential_address = case
      when p_updates ? 'address' and p_updates -> 'address' = 'null'::jsonb then null
      when p_updates ? 'address' then p_updates -> 'address'
      else residential_address
    end
  where user_id = p_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select jsonb_agg(key order by key)
  into changed_fields
  from jsonb_object_keys(p_updates) as key;

  insert into public.audit_events (
    actor_user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    p_user_id,
    null,
    'profile.personal.updated',
    'profile',
    p_user_id,
    jsonb_build_object('changed_fields', changed_fields)
  );
end;
$$;

create or replace function public.update_organization_profile_with_audit(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  changed_fields jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'ORGANIZATION_PROFILE_SERVICE_ROLE_REQUIRED';
  end if;

  if p_actor_user_id is null or p_organization_id is null or p_updates is null or jsonb_typeof(p_updates) <> 'object' or p_updates = '{}'::jsonb then
    raise exception 'ORGANIZATION_PROFILE_UPDATE_INVALID_INPUT';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as key
    where key not in ('legal_name', 'display_name', 'tax_identifier', 'email', 'phone', 'address')
  ) then
    raise exception 'ORGANIZATION_PROFILE_UPDATE_FIELD_FORBIDDEN';
  end if;

  update public.organizations
  set
    legal_name = case when p_updates ? 'legal_name' then nullif(btrim(p_updates ->> 'legal_name'), '') else legal_name end,
    display_name = case when p_updates ? 'display_name' then btrim(p_updates ->> 'display_name') else display_name end,
    tax_identifier = case when p_updates ? 'tax_identifier' then nullif(btrim(p_updates ->> 'tax_identifier'), '') else tax_identifier end,
    email = case when p_updates ? 'email' then nullif(btrim(p_updates ->> 'email'), '') else email end,
    phone = case when p_updates ? 'phone' then nullif(btrim(p_updates ->> 'phone'), '') else phone end,
    registered_address = case
      when p_updates ? 'address' and p_updates -> 'address' = 'null'::jsonb then null
      when p_updates ? 'address' then p_updates -> 'address'
      else registered_address
    end
  where id = p_organization_id;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  select jsonb_agg(key order by key)
  into changed_fields
  from jsonb_object_keys(p_updates) as key;

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
    'organization.legal_profile.updated',
    'organization',
    p_organization_id,
    jsonb_build_object('changed_fields', changed_fields)
  );
end;
$$;

revoke all on function public.update_personal_profile_with_audit(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_organization_profile_with_audit(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_personal_profile_with_audit(uuid, jsonb) to service_role;
grant execute on function public.update_organization_profile_with_audit(uuid, uuid, jsonb) to service_role;
