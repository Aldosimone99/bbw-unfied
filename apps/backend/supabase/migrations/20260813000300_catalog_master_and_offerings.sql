-- Canonical BBW master catalog and context-scoped treatment offerings.
-- The master is independent from local prices, durations, points and active state.

create table public.treatment_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint treatment_categories_code_check check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint treatment_categories_display_name_check check (btrim(display_name) <> ''),
  constraint treatment_categories_sort_order_check check (sort_order >= 0)
);

create table public.catalog_treatments (
  id uuid primary key default gen_random_uuid(),
  external_code text not null unique,
  name text not null,
  category_id uuid not null references public.treatment_categories (id) on delete restrict,
  description text,
  body_area text,
  default_points integer not null default 0,
  default_price_cents integer not null default 0,
  default_duration_min_minutes integer not null,
  default_duration_max_minutes integer not null,
  duration_label text not null,
  professional_requirements text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint catalog_treatments_name_check check (btrim(name) <> ''),
  constraint catalog_treatments_points_check check (default_points >= 0),
  constraint catalog_treatments_price_check check (default_price_cents >= 0),
  constraint catalog_treatments_duration_check check (
    default_duration_min_minutes > 0 and default_duration_max_minutes >= default_duration_min_minutes
  ),
  constraint catalog_treatments_duration_label_check check (btrim(duration_label) <> ''),
  constraint catalog_treatments_body_area_check check (body_area is null or btrim(body_area) <> '')
);

create table public.organization_treatment_offerings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  catalog_treatment_id uuid not null references public.catalog_treatments (id) on delete restrict,
  price_cents integer not null,
  duration_minutes integer not null,
  points integer not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organization_treatment_offerings_price_check check (price_cents >= 0),
  constraint organization_treatment_offerings_duration_check check (duration_minutes > 0),
  constraint organization_treatment_offerings_points_check check (points >= 0),
  constraint organization_treatment_offerings_unique unique (organization_id, catalog_treatment_id)
);

create table public.professional_treatment_offerings (
  id uuid primary key default gen_random_uuid(),
  professional_profile_id uuid not null references public.professional_profiles (id) on delete restrict,
  catalog_treatment_id uuid not null references public.catalog_treatments (id) on delete restrict,
  price_cents integer not null,
  duration_minutes integer not null,
  points integer not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint professional_treatment_offerings_price_check check (price_cents >= 0),
  constraint professional_treatment_offerings_duration_check check (duration_minutes > 0),
  constraint professional_treatment_offerings_points_check check (points >= 0),
  constraint professional_treatment_offerings_unique unique (professional_profile_id, catalog_treatment_id)
);

create index treatment_categories_active_idx on public.treatment_categories (is_active, sort_order, code);
create index catalog_treatments_category_idx on public.catalog_treatments (category_id, is_active, name);
create index catalog_treatments_body_area_idx on public.catalog_treatments (body_area, is_active);
create index organization_treatment_offerings_scope_idx on public.organization_treatment_offerings (organization_id, is_active, updated_at desc);
create index professional_treatment_offerings_scope_idx on public.professional_treatment_offerings (professional_profile_id, is_active, updated_at desc);

create or replace function public.import_catalog_master(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  item jsonb;
  category_id uuid;
  category_code text;
  category_display_name text;
  external_code text;
  incoming_codes text[] := array[]::text[];
  incoming_category_codes text[] := array[]::text[];
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'CATALOG_IMPORT_EMPTY'; end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    category_code := nullif(btrim(item ->> 'categoryCode'), '');
    category_display_name := nullif(btrim(item ->> 'categoryDisplayName'), '');
    external_code := nullif(btrim(item ->> 'externalCode'), '');
    if category_code is null or category_display_name is null or external_code is null then raise exception 'CATALOG_IMPORT_INVALID_ROW'; end if;
    if not (category_code = any(incoming_category_codes)) then
      incoming_category_codes := array_append(incoming_category_codes, category_code);
      insert into public.treatment_categories (code, display_name, sort_order, is_active)
      values (category_code, category_display_name, (item ->> 'categorySortOrder')::integer, true)
      on conflict (code) do update set display_name = excluded.display_name, sort_order = excluded.sort_order,
        is_active = true, updated_at = timezone('utc', now())
      returning id into category_id;
    else
      select id into category_id from public.treatment_categories where code = category_code;
    end if;

    incoming_codes := array_append(incoming_codes, external_code);
    insert into public.catalog_treatments (
      external_code, name, category_id, description, body_area, default_points, default_price_cents,
      default_duration_min_minutes, default_duration_max_minutes, duration_label, professional_requirements, is_active
    )
    values (
      external_code, btrim(item ->> 'name'), category_id, item ->> 'description', btrim(item ->> 'bodyArea'),
      (item ->> 'points')::integer, (item ->> 'priceCents')::integer, (item ->> 'durationMinMinutes')::integer,
      (item ->> 'durationMaxMinutes')::integer, btrim(item ->> 'durationLabel'),
      array(select jsonb_array_elements_text(item -> 'professionalRequirements')), true
    )
    on conflict (external_code) do update set
      name = excluded.name, category_id = excluded.category_id, description = excluded.description,
      body_area = excluded.body_area, default_points = excluded.default_points, default_price_cents = excluded.default_price_cents,
      default_duration_min_minutes = excluded.default_duration_min_minutes,
      default_duration_max_minutes = excluded.default_duration_max_minutes, duration_label = excluded.duration_label,
      professional_requirements = excluded.professional_requirements, is_active = true,
      updated_at = timezone('utc', now());
  end loop;

  update public.catalog_treatments
  set is_active = false, updated_at = timezone('utc', now())
  where is_active and not (external_code = any(incoming_codes));
  update public.treatment_categories
  set is_active = false, updated_at = timezone('utc', now())
  where is_active and not (code = any(incoming_category_codes));

  return jsonb_build_object('categories', cardinality(incoming_category_codes), 'treatments', cardinality(incoming_codes));
end;
$$;

create or replace function public.list_organization_treatment_offerings(p_organization_id uuid)
returns table (
  offering_id uuid,
  organization_id uuid,
  professional_profile_id uuid,
  catalog_treatment_id uuid,
  external_code text,
  name text,
  category_code text,
  category_display_name text,
  body_area text,
  default_price_cents integer,
  default_duration_min_minutes integer,
  default_duration_max_minutes integer,
  default_points integer,
  price_cents integer,
  duration_minutes integer,
  points integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select offering.id, offering.organization_id, null::uuid, treatment.id, treatment.external_code,
    treatment.name, category.code, category.display_name, treatment.body_area,
    treatment.default_price_cents, treatment.default_duration_min_minutes, treatment.default_duration_max_minutes,
    treatment.default_points, offering.price_cents, offering.duration_minutes, offering.points,
    offering.is_active, offering.created_at, offering.updated_at
  from public.organization_treatment_offerings offering
  join public.catalog_treatments treatment on treatment.id = offering.catalog_treatment_id
  join public.treatment_categories category on category.id = treatment.category_id
  where offering.organization_id = p_organization_id
  order by treatment.name asc;
$$;

create or replace function public.list_professional_treatment_offerings(p_professional_profile_id uuid)
returns table (
  offering_id uuid,
  organization_id uuid,
  professional_profile_id uuid,
  catalog_treatment_id uuid,
  external_code text,
  name text,
  category_code text,
  category_display_name text,
  body_area text,
  default_price_cents integer,
  default_duration_min_minutes integer,
  default_duration_max_minutes integer,
  default_points integer,
  price_cents integer,
  duration_minutes integer,
  points integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select offering.id, null::uuid, offering.professional_profile_id, treatment.id, treatment.external_code,
    treatment.name, category.code, category.display_name, treatment.body_area,
    treatment.default_price_cents, treatment.default_duration_min_minutes, treatment.default_duration_max_minutes,
    treatment.default_points, offering.price_cents, offering.duration_minutes, offering.points,
    offering.is_active, offering.created_at, offering.updated_at
  from public.professional_treatment_offerings offering
  join public.catalog_treatments treatment on treatment.id = offering.catalog_treatment_id
  join public.treatment_categories category on category.id = treatment.category_id
  where offering.professional_profile_id = p_professional_profile_id
  order by treatment.name asc;
$$;

create or replace function public.create_organization_treatment_offering(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_catalog_treatment_id uuid,
  p_price_cents integer,
  p_duration_minutes integer,
  p_points integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare offering_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id and status = 'active') then raise exception 'CATALOG_ORGANIZATION_NOT_FOUND'; end if;
  if not exists (select 1 from public.catalog_treatments where id = p_catalog_treatment_id and is_active) then raise exception 'CATALOG_TREATMENT_NOT_FOUND'; end if;
  if p_price_cents is null or p_price_cents < 0 or p_duration_minutes is null or p_duration_minutes <= 0 or p_points is null or p_points < 0 then raise exception 'CATALOG_OFFERING_INVALID_INPUT'; end if;

  insert into public.organization_treatment_offerings (organization_id, catalog_treatment_id, price_cents, duration_minutes, points, created_by, is_active)
  values (p_organization_id, p_catalog_treatment_id, p_price_cents, p_duration_minutes, p_points, p_actor_user_id, true)
  on conflict (organization_id, catalog_treatment_id) do update
    set price_cents = excluded.price_cents, duration_minutes = excluded.duration_minutes, points = excluded.points,
        is_active = true, created_by = excluded.created_by, updated_at = timezone('utc', now())
  returning id into offering_id;

  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, p_organization_id, 'catalog.offering.created', 'organization_treatment_offering', offering_id,
          jsonb_build_object('catalog_treatment_id', p_catalog_treatment_id));
  return offering_id;
end;
$$;

create or replace function public.create_professional_treatment_offering(
  p_actor_user_id uuid,
  p_professional_profile_id uuid,
  p_catalog_treatment_id uuid,
  p_price_cents integer,
  p_duration_minutes integer,
  p_points integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare offering_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  if not exists (select 1 from public.professional_profiles where id = p_professional_profile_id) then raise exception 'CATALOG_PROFESSIONAL_PROFILE_NOT_FOUND'; end if;
  if not exists (select 1 from public.catalog_treatments where id = p_catalog_treatment_id and is_active) then raise exception 'CATALOG_TREATMENT_NOT_FOUND'; end if;
  if p_price_cents is null or p_price_cents < 0 or p_duration_minutes is null or p_duration_minutes <= 0 or p_points is null or p_points < 0 then raise exception 'CATALOG_OFFERING_INVALID_INPUT'; end if;

  insert into public.professional_treatment_offerings (professional_profile_id, catalog_treatment_id, price_cents, duration_minutes, points, created_by, is_active)
  values (p_professional_profile_id, p_catalog_treatment_id, p_price_cents, p_duration_minutes, p_points, p_actor_user_id, true)
  on conflict (professional_profile_id, catalog_treatment_id) do update
    set price_cents = excluded.price_cents, duration_minutes = excluded.duration_minutes, points = excluded.points,
        is_active = true, created_by = excluded.created_by, updated_at = timezone('utc', now())
  returning id into offering_id;

  insert into public.audit_events (actor_user_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, 'catalog.offering.created', 'professional_treatment_offering', offering_id,
          jsonb_build_object('catalog_treatment_id', p_catalog_treatment_id, 'professional_profile_id', p_professional_profile_id));
  return offering_id;
end;
$$;

create or replace function public.update_organization_treatment_offering(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_offering_id uuid,
  p_updates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare changed_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' or p_updates = '{}'::jsonb then raise exception 'CATALOG_OFFERING_INVALID_INPUT'; end if;
  if exists (select 1 from jsonb_object_keys(p_updates) key where key not in ('price_cents', 'duration_minutes', 'points', 'is_active')) then raise exception 'CATALOG_OFFERING_FIELD_FORBIDDEN'; end if;

  update public.organization_treatment_offerings
  set price_cents = case when p_updates ? 'price_cents' then (p_updates ->> 'price_cents')::integer else price_cents end,
      duration_minutes = case when p_updates ? 'duration_minutes' then (p_updates ->> 'duration_minutes')::integer else duration_minutes end,
      points = case when p_updates ? 'points' then (p_updates ->> 'points')::integer else points end,
      is_active = case when p_updates ? 'is_active' then (p_updates ->> 'is_active')::boolean else is_active end,
      updated_at = timezone('utc', now())
  where id = p_offering_id and organization_id = p_organization_id
  returning id into changed_id;
  if changed_id is null then raise exception 'CATALOG_OFFERING_NOT_FOUND'; end if;

  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, p_organization_id, 'catalog.offering.updated', 'organization_treatment_offering', changed_id,
          jsonb_build_object('changed_fields', (select jsonb_agg(key order by key) from jsonb_object_keys(p_updates) key)));
  return changed_id;
end;
$$;

create or replace function public.update_professional_treatment_offering(
  p_actor_user_id uuid,
  p_professional_profile_id uuid,
  p_offering_id uuid,
  p_updates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare changed_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' or p_updates = '{}'::jsonb then raise exception 'CATALOG_OFFERING_INVALID_INPUT'; end if;
  if exists (select 1 from jsonb_object_keys(p_updates) key where key not in ('price_cents', 'duration_minutes', 'points', 'is_active')) then raise exception 'CATALOG_OFFERING_FIELD_FORBIDDEN'; end if;

  update public.professional_treatment_offerings
  set price_cents = case when p_updates ? 'price_cents' then (p_updates ->> 'price_cents')::integer else price_cents end,
      duration_minutes = case when p_updates ? 'duration_minutes' then (p_updates ->> 'duration_minutes')::integer else duration_minutes end,
      points = case when p_updates ? 'points' then (p_updates ->> 'points')::integer else points end,
      is_active = case when p_updates ? 'is_active' then (p_updates ->> 'is_active')::boolean else is_active end,
      updated_at = timezone('utc', now())
  where id = p_offering_id and professional_profile_id = p_professional_profile_id
  returning id into changed_id;
  if changed_id is null then raise exception 'CATALOG_OFFERING_NOT_FOUND'; end if;

  insert into public.audit_events (actor_user_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, 'catalog.offering.updated', 'professional_treatment_offering', changed_id,
          jsonb_build_object('changed_fields', (select jsonb_agg(key order by key) from jsonb_object_keys(p_updates) key)));
  return changed_id;
end;
$$;

create or replace function public.remove_organization_treatment_offering(
  p_actor_user_id uuid, p_organization_id uuid, p_offering_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare changed_id uuid; treatment_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  update public.organization_treatment_offerings set is_active = false, updated_at = timezone('utc', now())
  where id = p_offering_id and organization_id = p_organization_id and is_active
  returning id, catalog_treatment_id into changed_id, treatment_id;
  if changed_id is null then raise exception 'CATALOG_OFFERING_NOT_FOUND'; end if;
  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, p_organization_id, 'catalog.offering.removed', 'organization_treatment_offering', changed_id,
          jsonb_build_object('catalog_treatment_id', treatment_id));
  return changed_id;
end;
$$;

create or replace function public.remove_professional_treatment_offering(
  p_actor_user_id uuid, p_professional_profile_id uuid, p_offering_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare changed_id uuid; treatment_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  update public.professional_treatment_offerings set is_active = false, updated_at = timezone('utc', now())
  where id = p_offering_id and professional_profile_id = p_professional_profile_id and is_active
  returning id, catalog_treatment_id into changed_id, treatment_id;
  if changed_id is null then raise exception 'CATALOG_OFFERING_NOT_FOUND'; end if;
  insert into public.audit_events (actor_user_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, 'catalog.offering.removed', 'professional_treatment_offering', changed_id,
          jsonb_build_object('catalog_treatment_id', treatment_id, 'professional_profile_id', p_professional_profile_id));
  return changed_id;
end;
$$;

alter table public.treatment_categories enable row level security;
alter table public.catalog_treatments enable row level security;
alter table public.organization_treatment_offerings enable row level security;
alter table public.professional_treatment_offerings enable row level security;

create policy treatment_categories_select_active on public.treatment_categories
for select to authenticated using (is_active);
create policy catalog_treatments_select_active on public.catalog_treatments
for select to authenticated using (is_active);

create policy organization_treatment_offerings_select on public.organization_treatment_offerings
for select to authenticated using (
  exists (
    select 1 from public.organization_members membership
    join public.member_roles member_role on member_role.organization_member_id = membership.id
    join public.role_permissions mapping on mapping.role_id = member_role.role_id
    join public.permissions permission on permission.id = mapping.permission_id
    where membership.organization_id = organization_treatment_offerings.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and permission.code = 'catalog.offering.read'
  )
);
create policy organization_treatment_offerings_insert on public.organization_treatment_offerings
for insert to authenticated with check (
  exists (
    select 1 from public.organization_members membership
    join public.member_roles member_role on member_role.organization_member_id = membership.id
    join public.role_permissions mapping on mapping.role_id = member_role.role_id
    join public.permissions permission on permission.id = mapping.permission_id
    where membership.organization_id = organization_treatment_offerings.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and permission.code = 'catalog.offering.create'
  )
);
create policy organization_treatment_offerings_update on public.organization_treatment_offerings
for update to authenticated using (
  exists (
    select 1 from public.organization_members membership
    join public.member_roles member_role on member_role.organization_member_id = membership.id
    join public.role_permissions mapping on mapping.role_id = member_role.role_id
    join public.permissions permission on permission.id = mapping.permission_id
    where membership.organization_id = organization_treatment_offerings.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and permission.code in ('catalog.offering.update', 'catalog.offering.remove')
  )
) with check (
  exists (
    select 1 from public.organization_members membership
    join public.member_roles member_role on member_role.organization_member_id = membership.id
    join public.role_permissions mapping on mapping.role_id = member_role.role_id
    join public.permissions permission on permission.id = mapping.permission_id
    where membership.organization_id = organization_treatment_offerings.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and permission.code in ('catalog.offering.update', 'catalog.offering.remove')
  )
);

create policy professional_treatment_offerings_select on public.professional_treatment_offerings
for select to authenticated using (
  exists (
    select 1 from public.professional_profiles professional
    join public.professional_types professional_type on professional_type.id = professional.professional_type_id
    where professional.id = professional_treatment_offerings.professional_profile_id
      and professional.user_id = (select auth.uid())
      and professional_type.is_active
      and professional.verification_status not in ('rejected', 'suspended')
      and (not professional_type.verification_required or professional.verification_status = 'verified')
  )
);
create policy professional_treatment_offerings_insert on public.professional_treatment_offerings
for insert to authenticated with check (
  exists (
    select 1 from public.professional_profiles professional
    join public.professional_types professional_type on professional_type.id = professional.professional_type_id
    where professional.id = professional_treatment_offerings.professional_profile_id
      and professional.user_id = (select auth.uid())
      and professional_type.is_active
      and professional.verification_status not in ('rejected', 'suspended')
      and (not professional_type.verification_required or professional.verification_status = 'verified')
  )
);
create policy professional_treatment_offerings_update on public.professional_treatment_offerings
for update to authenticated using (
  exists (
    select 1 from public.professional_profiles professional
    join public.professional_types professional_type on professional_type.id = professional.professional_type_id
    where professional.id = professional_treatment_offerings.professional_profile_id
      and professional.user_id = (select auth.uid())
      and professional_type.is_active
      and professional.verification_status not in ('rejected', 'suspended')
      and (not professional_type.verification_required or professional.verification_status = 'verified')
  )
)
with check (
    exists (
      select 1 from public.professional_profiles professional
      join public.professional_types professional_type on professional_type.id = professional.professional_type_id
      where professional.id = professional_treatment_offerings.professional_profile_id
        and professional.user_id = (select auth.uid())
        and professional_type.is_active
        and professional.verification_status not in ('rejected', 'suspended')
        and (not professional_type.verification_required or professional.verification_status = 'verified')
    )
  );

revoke all on public.treatment_categories, public.catalog_treatments, public.organization_treatment_offerings, public.professional_treatment_offerings from anon, authenticated;
grant select on public.treatment_categories, public.catalog_treatments, public.organization_treatment_offerings, public.professional_treatment_offerings to authenticated;
grant select, insert, update, delete on public.treatment_categories, public.catalog_treatments, public.organization_treatment_offerings, public.professional_treatment_offerings to service_role;

revoke all on function public.import_catalog_master(jsonb) from public, anon, authenticated;
revoke all on function public.list_organization_treatment_offerings(uuid) from public, anon, authenticated;
revoke all on function public.list_professional_treatment_offerings(uuid) from public, anon, authenticated;
revoke all on function public.create_organization_treatment_offering(uuid, uuid, uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.create_professional_treatment_offering(uuid, uuid, uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.update_organization_treatment_offering(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_professional_treatment_offering(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.remove_organization_treatment_offering(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_professional_treatment_offering(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.import_catalog_master(jsonb) to service_role;
grant execute on function public.list_organization_treatment_offerings(uuid) to service_role;
grant execute on function public.list_professional_treatment_offerings(uuid) to service_role;
grant execute on function public.create_organization_treatment_offering(uuid, uuid, uuid, integer, integer, integer) to service_role;
grant execute on function public.create_professional_treatment_offering(uuid, uuid, uuid, integer, integer, integer) to service_role;
grant execute on function public.update_organization_treatment_offering(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.update_professional_treatment_offering(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.remove_organization_treatment_offering(uuid, uuid, uuid) to service_role;
grant execute on function public.remove_professional_treatment_offering(uuid, uuid, uuid) to service_role;
