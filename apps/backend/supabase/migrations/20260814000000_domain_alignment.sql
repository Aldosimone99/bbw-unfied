-- Domain alignment pass: canonical treatment sources, scoped relationship origin,
-- preparatory patient logical deletion and append-only audit enforcement.
-- This migration is additive and does not modify archived transition migrations.

alter table public.subjects
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null;

create index subjects_deleted_idx
  on public.subjects (deleted_at)
  where deleted_at is not null;

alter table public.catalog_treatments
  add column source text not null default 'bbw_template',
  add column owner_organization_id uuid references public.organizations (id) on delete restrict,
  add column owner_professional_profile_id uuid references public.professional_profiles (id) on delete restrict;

alter table public.catalog_treatments
  add constraint catalog_treatments_source_check
    check (source in ('bbw_template', 'organization', 'professional')),
  add constraint catalog_treatments_owner_check
    check (
      (source = 'bbw_template' and owner_organization_id is null and owner_professional_profile_id is null)
      or (source = 'organization' and owner_organization_id is not null and owner_professional_profile_id is null)
      or (source = 'professional' and owner_organization_id is null and owner_professional_profile_id is not null)
    );

create index catalog_treatments_source_owner_idx
  on public.catalog_treatments (source, owner_organization_id, owner_professional_profile_id, is_active);

alter table public.organization_treatment_offerings
  add column description text;

alter table public.professional_treatment_offerings
  add column description text;

alter table public.organization_patient_relationships
  add column origin_kind text,
  add column origin_organization_id uuid references public.organizations (id) on delete restrict,
  add column origin_professional_profile_id uuid references public.professional_profiles (id) on delete restrict;

update public.organization_patient_relationships
set origin_kind = 'organization',
    origin_organization_id = organization_id
where origin_kind is null;

alter table public.organization_patient_relationships
  alter column origin_kind set not null,
  alter column origin_organization_id set not null;

alter table public.organization_patient_relationships
  add constraint organization_patient_relationship_origin_check
    check (
      origin_kind = 'organization'
      and origin_organization_id = organization_id
      and origin_professional_profile_id is null
    );

alter table public.professional_patient_relationships
  add column origin_kind text,
  add column origin_organization_id uuid references public.organizations (id) on delete restrict,
  add column origin_professional_profile_id uuid references public.professional_profiles (id) on delete restrict;

update public.professional_patient_relationships
set origin_kind = 'professional',
    origin_professional_profile_id = professional_profile_id
where origin_kind is null;

alter table public.professional_patient_relationships
  alter column origin_kind set not null,
  alter column origin_professional_profile_id set not null;

alter table public.professional_patient_relationships
  add constraint professional_patient_relationship_origin_check
    check (
      origin_kind = 'professional'
      and origin_professional_profile_id = professional_profile_id
      and origin_organization_id is null
    );

create index organization_patient_relationships_origin_idx
  on public.organization_patient_relationships (origin_kind, origin_organization_id);
create index professional_patient_relationships_origin_idx
  on public.professional_patient_relationships (origin_kind, origin_professional_profile_id);

-- Replace the permissive active-only definition policy with context-aware access.
drop policy if exists catalog_treatments_select_active on public.catalog_treatments;
create policy catalog_treatments_select_accessible on public.catalog_treatments
for select to authenticated using (
  is_active
  and (
    source = 'bbw_template'
    or (
      source = 'organization'
      and exists (
        select 1
        from public.organization_members membership
        where membership.organization_id = catalog_treatments.owner_organization_id
          and membership.user_id = (select auth.uid())
          and membership.status = 'active'
      )
    )
    or (
      source = 'professional'
      and exists (
        select 1
        from public.professional_profiles professional
        where professional.id = catalog_treatments.owner_professional_profile_id
          and professional.user_id = (select auth.uid())
      )
    )
  )
);

drop function if exists public.list_accessible_treatment_definitions(text, uuid);

create function public.list_accessible_treatment_definitions(
  p_scope_kind text,
  p_scope_id uuid
)
returns table (
  id uuid,
  external_code text,
  name text,
  category_id uuid,
  category_code text,
  category_display_name text,
  description text,
  body_area text,
  default_points integer,
  default_price_cents integer,
  default_duration_min_minutes integer,
  default_duration_max_minutes integer,
  duration_label text,
  professional_requirements text[],
  is_active boolean,
  source text,
  owner_organization_id uuid,
  owner_professional_profile_id uuid
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    treatment.id,
    treatment.external_code,
    treatment.name,
    treatment.category_id,
    category.code,
    category.display_name,
    treatment.description,
    treatment.body_area,
    treatment.default_points,
    treatment.default_price_cents,
    treatment.default_duration_min_minutes,
    treatment.default_duration_max_minutes,
    treatment.duration_label,
    treatment.professional_requirements,
    treatment.is_active,
    treatment.source,
    treatment.owner_organization_id,
    treatment.owner_professional_profile_id
  from public.catalog_treatments treatment
  join public.treatment_categories category on category.id = treatment.category_id
  where treatment.is_active
    and (
      treatment.source = 'bbw_template'
      or (p_scope_kind = 'organization' and treatment.source = 'organization' and treatment.owner_organization_id = p_scope_id)
      or (p_scope_kind = 'personal_professional' and treatment.source = 'professional' and treatment.owner_professional_profile_id = p_scope_id)
    )
  order by treatment.name asc;
$$;

create or replace function public.create_organization_custom_treatment(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_body_area text,
  p_price_cents integer,
  p_duration_minutes integer,
  p_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  definition_id uuid;
  offering_id uuid;
  external_code text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'CATALOG_SERVICE_ROLE_REQUIRED';
  end if;
  if p_actor_user_id is null or p_organization_id is null or p_name is null or btrim(p_name) = ''
    or p_category_id is null or p_price_cents is null or p_price_cents < 0
    or p_duration_minutes is null or p_duration_minutes <= 0
    or p_points is null or p_points < 0 then
    raise exception 'CATALOG_CUSTOM_TREATMENT_INVALID_INPUT';
  end if;
  if not exists (
    select 1 from public.organizations
    where id = p_organization_id and status = 'active'
  ) then
    raise exception 'CATALOG_ORGANIZATION_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.treatment_categories
    where id = p_category_id and is_active
  ) then
    raise exception 'CATALOG_CATEGORY_NOT_FOUND';
  end if;

  external_code := 'organization_' || gen_random_uuid()::text;
  insert into public.catalog_treatments (
    external_code, name, category_id, description, body_area,
    default_points, default_price_cents, default_duration_min_minutes,
    default_duration_max_minutes, duration_label, professional_requirements,
    source, owner_organization_id, is_active
  )
  values (
    external_code, btrim(p_name), p_category_id, nullif(btrim(p_description), ''),
    nullif(btrim(p_body_area), ''), p_points, p_price_cents, p_duration_minutes,
    p_duration_minutes, p_duration_minutes::text || ' min', '{}',
    'organization', p_organization_id, true
  )
  returning id into definition_id;

  insert into public.organization_treatment_offerings (
    organization_id, catalog_treatment_id, description, price_cents,
    duration_minutes, points, is_active, created_by
  )
  values (
    p_organization_id, definition_id, nullif(btrim(p_description), ''),
    p_price_cents, p_duration_minutes, p_points, true, p_actor_user_id
  )
  returning id into offering_id;

  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values
    (p_actor_user_id, p_organization_id, 'catalog.treatment_definition.created', 'treatment_definition', definition_id,
      jsonb_build_object('source', 'organization')),
    (p_actor_user_id, p_organization_id, 'catalog.offering.created', 'organization_treatment_offering', offering_id,
      jsonb_build_object('treatment_definition_id', definition_id, 'source', 'organization'));

  return jsonb_build_object('definition_id', definition_id, 'offering_id', offering_id);
end;
$$;

create or replace function public.create_professional_custom_treatment(
  p_actor_user_id uuid,
  p_professional_profile_id uuid,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_body_area text,
  p_price_cents integer,
  p_duration_minutes integer,
  p_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  definition_id uuid;
  offering_id uuid;
  external_code text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'CATALOG_SERVICE_ROLE_REQUIRED';
  end if;
  if p_actor_user_id is null or p_professional_profile_id is null or p_name is null or btrim(p_name) = ''
    or p_category_id is null or p_price_cents is null or p_price_cents < 0
    or p_duration_minutes is null or p_duration_minutes <= 0
    or p_points is null or p_points < 0 then
    raise exception 'CATALOG_CUSTOM_TREATMENT_INVALID_INPUT';
  end if;
  if not exists (
    select 1 from public.professional_profiles
    where id = p_professional_profile_id and user_id = p_actor_user_id
  ) then
    raise exception 'CATALOG_PROFESSIONAL_PROFILE_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.treatment_categories
    where id = p_category_id and is_active
  ) then
    raise exception 'CATALOG_CATEGORY_NOT_FOUND';
  end if;

  external_code := 'professional_' || gen_random_uuid()::text;
  insert into public.catalog_treatments (
    external_code, name, category_id, description, body_area,
    default_points, default_price_cents, default_duration_min_minutes,
    default_duration_max_minutes, duration_label, professional_requirements,
    source, owner_professional_profile_id, is_active
  )
  values (
    external_code, btrim(p_name), p_category_id, nullif(btrim(p_description), ''),
    nullif(btrim(p_body_area), ''), p_points, p_price_cents, p_duration_minutes,
    p_duration_minutes, p_duration_minutes::text || ' min', '{}',
    'professional', p_professional_profile_id, true
  )
  returning id into definition_id;

  insert into public.professional_treatment_offerings (
    professional_profile_id, catalog_treatment_id, description, price_cents,
    duration_minutes, points, is_active, created_by
  )
  values (
    p_professional_profile_id, definition_id, nullif(btrim(p_description), ''),
    p_price_cents, p_duration_minutes, p_points, true, p_actor_user_id
  )
  returning id into offering_id;

  insert into public.audit_events (actor_user_id, action, resource_type, resource_id, metadata)
  values
    (p_actor_user_id, 'catalog.treatment_definition.created', 'treatment_definition', definition_id,
      jsonb_build_object('source', 'professional', 'professional_profile_id', p_professional_profile_id)),
    (p_actor_user_id, 'catalog.offering.created', 'professional_treatment_offering', offering_id,
      jsonb_build_object('treatment_definition_id', definition_id, 'source', 'professional'));

  return jsonb_build_object('definition_id', definition_id, 'offering_id', offering_id);
end;
$$;

create or replace function public.list_organization_treatment_offerings_v2(p_organization_id uuid)
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
  description text,
  default_price_cents integer,
  default_duration_min_minutes integer,
  default_duration_max_minutes integer,
  default_points integer,
  price_cents integer,
  duration_minutes integer,
  points integer,
  is_active boolean,
  source text,
  owner_organization_id uuid,
  owner_professional_profile_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select offering.id, offering.organization_id, null::uuid, treatment.id,
    treatment.external_code, treatment.name, category.code, category.display_name,
    treatment.body_area, offering.description, treatment.default_price_cents,
    treatment.default_duration_min_minutes, treatment.default_duration_max_minutes,
    treatment.default_points, offering.price_cents, offering.duration_minutes,
    offering.points, offering.is_active, treatment.source,
    treatment.owner_organization_id, treatment.owner_professional_profile_id,
    offering.created_at, offering.updated_at
  from public.organization_treatment_offerings offering
  join public.catalog_treatments treatment on treatment.id = offering.catalog_treatment_id
  join public.treatment_categories category on category.id = treatment.category_id
  where offering.organization_id = p_organization_id
  order by treatment.name asc;
$$;

create or replace function public.list_professional_treatment_offerings_v2(p_professional_profile_id uuid)
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
  description text,
  default_price_cents integer,
  default_duration_min_minutes integer,
  default_duration_max_minutes integer,
  default_points integer,
  price_cents integer,
  duration_minutes integer,
  points integer,
  is_active boolean,
  source text,
  owner_organization_id uuid,
  owner_professional_profile_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select offering.id, null::uuid, offering.professional_profile_id, treatment.id,
    treatment.external_code, treatment.name, category.code, category.display_name,
    treatment.body_area, offering.description, treatment.default_price_cents,
    treatment.default_duration_min_minutes, treatment.default_duration_max_minutes,
    treatment.default_points, offering.price_cents, offering.duration_minutes,
    offering.points, offering.is_active, treatment.source,
    treatment.owner_organization_id, treatment.owner_professional_profile_id,
    offering.created_at, offering.updated_at
  from public.professional_treatment_offerings offering
  join public.catalog_treatments treatment on treatment.id = offering.catalog_treatment_id
  join public.treatment_categories category on category.id = treatment.category_id
  where offering.professional_profile_id = p_professional_profile_id
  order by treatment.name asc;
$$;

-- Existing offering update functions retain their signatures and gain the
-- context description field without changing the existing API contract.
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
  if exists (select 1 from jsonb_object_keys(p_updates) key where key not in ('price_cents', 'duration_minutes', 'points', 'is_active', 'description')) then raise exception 'CATALOG_OFFERING_FIELD_FORBIDDEN'; end if;

  update public.organization_treatment_offerings
  set price_cents = case when p_updates ? 'price_cents' then (p_updates ->> 'price_cents')::integer else price_cents end,
      duration_minutes = case when p_updates ? 'duration_minutes' then (p_updates ->> 'duration_minutes')::integer else duration_minutes end,
      points = case when p_updates ? 'points' then (p_updates ->> 'points')::integer else points end,
      is_active = case when p_updates ? 'is_active' then (p_updates ->> 'is_active')::boolean else is_active end,
      description = case when p_updates ? 'description' then nullif(btrim(p_updates ->> 'description'), '') else description end,
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
  if exists (select 1 from jsonb_object_keys(p_updates) key where key not in ('price_cents', 'duration_minutes', 'points', 'is_active', 'description')) then raise exception 'CATALOG_OFFERING_FIELD_FORBIDDEN'; end if;

  update public.professional_treatment_offerings
  set price_cents = case when p_updates ? 'price_cents' then (p_updates ->> 'price_cents')::integer else price_cents end,
      duration_minutes = case when p_updates ? 'duration_minutes' then (p_updates ->> 'duration_minutes')::integer else duration_minutes end,
      points = case when p_updates ? 'points' then (p_updates ->> 'points')::integer else points end,
      is_active = case when p_updates ? 'is_active' then (p_updates ->> 'is_active')::boolean else is_active end,
      description = case when p_updates ? 'description' then nullif(btrim(p_updates ->> 'description'), '') else description end,
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

-- Patient lists and exact lookup must ignore logically deleted subjects.
drop function if exists public.list_organization_patient_relationships(uuid);

create function public.list_organization_patient_relationships(p_organization_id uuid)
returns table (
  relationship_id uuid, subject_id uuid, organization_id uuid, professional_profile_id uuid,
  origin_kind text, origin_organization_id uuid, origin_professional_profile_id uuid,
  first_name text, last_name text, email text, phone text, birth_date date,
  status text, linked_at timestamptz, removed_at timestamptz
)
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'PATIENT_SERVICE_ROLE_REQUIRED'; end if;
  return query
  select relationship.id, relationship.subject_id, relationship.organization_id, null::uuid,
    relationship.origin_kind, relationship.origin_organization_id, relationship.origin_professional_profile_id,
    profile.first_name, profile.last_name, account.email::text, profile.phone, profile.birth_date,
    relationship.status, relationship.created_at, relationship.removed_at
  from public.organization_patient_relationships relationship
  join public.subjects subject on subject.id = relationship.subject_id and subject.subject_kind = 'person' and subject.deleted_at is null
  join public.profiles profile on profile.user_id = subject.user_id
  join auth.users account on account.id = subject.user_id
  where relationship.organization_id = p_organization_id and relationship.status = 'active'
  order by relationship.created_at desc, account.email asc;
end;
$$;

drop function if exists public.list_professional_patient_relationships(uuid);

create function public.list_professional_patient_relationships(p_professional_profile_id uuid)
returns table (
  relationship_id uuid, subject_id uuid, organization_id uuid, professional_profile_id uuid,
  origin_kind text, origin_organization_id uuid, origin_professional_profile_id uuid,
  first_name text, last_name text, email text, phone text, birth_date date,
  status text, linked_at timestamptz, removed_at timestamptz
)
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'PATIENT_SERVICE_ROLE_REQUIRED'; end if;
  return query
  select relationship.id, relationship.subject_id, null::uuid, relationship.professional_profile_id,
    relationship.origin_kind, relationship.origin_organization_id, relationship.origin_professional_profile_id,
    profile.first_name, profile.last_name, account.email::text, profile.phone, profile.birth_date,
    relationship.status, relationship.created_at, relationship.removed_at
  from public.professional_patient_relationships relationship
  join public.subjects subject on subject.id = relationship.subject_id and subject.subject_kind = 'person' and subject.deleted_at is null
  join public.profiles profile on profile.user_id = subject.user_id
  join auth.users account on account.id = subject.user_id
  where relationship.professional_profile_id = p_professional_profile_id and relationship.status = 'active'
  order by relationship.created_at desc, account.email asc;
end;
$$;

create or replace function public.lookup_patient_accounts(p_email text default null, p_tax_code text default null)
returns table (subject_id uuid, user_id uuid, email text, first_name text, last_name text)
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'PATIENT_SERVICE_ROLE_REQUIRED'; end if;
  if ((nullif(btrim(p_email), '') is null) = (nullif(btrim(p_tax_code), '') is null)) then raise exception 'PATIENT_LOOKUP_EXACT_IDENTIFIER_REQUIRED'; end if;
  return query
  select subject.id, subject.user_id, account.email::text, profile.first_name, profile.last_name
  from public.subjects subject
  join public.profiles profile on profile.user_id = subject.user_id
  join auth.users account on account.id = subject.user_id
  where subject.subject_kind = 'person' and subject.deleted_at is null
    and ((nullif(btrim(p_email), '') is not null and lower(account.email) = lower(btrim(p_email)))
      or (nullif(btrim(p_tax_code), '') is not null and upper(profile.tax_code) = upper(btrim(p_tax_code))))
  limit 5;
end;
$$;

create or replace function public.soft_delete_patient_subject(
  p_subject_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'PATIENT_SERVICE_ROLE_REQUIRED'; end if;
  update public.subjects
  set deleted_at = coalesce(deleted_at, timezone('utc', now())), deleted_by = p_actor_user_id, updated_at = timezone('utc', now())
  where id = p_subject_id and subject_kind = 'person';
  if not found then raise exception 'PATIENT_SUBJECT_NOT_FOUND'; end if;
  insert into public.audit_events (actor_user_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, 'patient.subject.soft_deleted', 'subject', p_subject_id, '{}'::jsonb);
end;
$$;

-- Audit events are append-only. Retention/purge remains TBD and is deliberately
-- not implemented here.
create or replace function public.reject_audit_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  raise exception 'AUDIT_EVENT_IMMUTABLE';
end;
$$;

drop trigger if exists audit_events_immutable on public.audit_events;
create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function public.reject_audit_event_mutation();

revoke update, delete on public.audit_events from public, anon, authenticated, service_role;
grant insert, select on public.audit_events to service_role;

revoke all on function public.list_accessible_treatment_definitions(text, uuid) from public, anon, authenticated;
revoke all on function public.create_organization_custom_treatment(uuid, uuid, text, text, uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.create_professional_custom_treatment(uuid, uuid, text, text, uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.list_organization_treatment_offerings_v2(uuid) from public, anon, authenticated;
revoke all on function public.list_professional_treatment_offerings_v2(uuid) from public, anon, authenticated;
revoke all on function public.soft_delete_patient_subject(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_accessible_treatment_definitions(text, uuid) to service_role;
grant execute on function public.create_organization_custom_treatment(uuid, uuid, text, text, uuid, text, integer, integer, integer) to service_role;
grant execute on function public.create_professional_custom_treatment(uuid, uuid, text, text, uuid, text, integer, integer, integer) to service_role;
grant execute on function public.list_organization_treatment_offerings_v2(uuid) to service_role;
grant execute on function public.list_professional_treatment_offerings_v2(uuid) to service_role;
grant execute on function public.soft_delete_patient_subject(uuid, uuid) to service_role;

-- Re-define the importer so CSV synchronization only owns BBW templates;
-- organization/professional custom definitions are never deactivated by import.
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
  incoming_external_code text;
  incoming_codes text[] := array[]::text[];
  incoming_category_codes text[] := array[]::text[];
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'CATALOG_IMPORT_EMPTY'; end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    category_code := nullif(btrim(item ->> 'categoryCode'), '');
    category_display_name := nullif(btrim(item ->> 'categoryDisplayName'), '');
    incoming_external_code := nullif(btrim(item ->> 'externalCode'), '');
    if category_code is null or category_display_name is null or incoming_external_code is null then raise exception 'CATALOG_IMPORT_INVALID_ROW'; end if;
    if not (category_code = any(incoming_category_codes)) then
      incoming_category_codes := array_append(incoming_category_codes, category_code);
      insert into public.treatment_categories (code, display_name, sort_order, is_active)
      values (category_code, category_display_name, (item ->> 'categorySortOrder')::integer, true)
      on conflict (code) do update set display_name = excluded.display_name, sort_order = excluded.sort_order,
        is_active = true, updated_at = timezone('utc', now())
      returning id into category_id;
    else
      select category.id into category_id from public.treatment_categories category where category.code = category_code;
    end if;

    incoming_codes := array_append(incoming_codes, incoming_external_code);
    insert into public.catalog_treatments (
      external_code, name, category_id, description, body_area, default_points, default_price_cents,
      default_duration_min_minutes, default_duration_max_minutes, duration_label, professional_requirements,
      source, is_active
    )
    values (
      incoming_external_code, btrim(item ->> 'name'), category_id, item ->> 'description', btrim(item ->> 'bodyArea'),
      (item ->> 'points')::integer, (item ->> 'priceCents')::integer, (item ->> 'durationMinMinutes')::integer,
      (item ->> 'durationMaxMinutes')::integer, btrim(item ->> 'durationLabel'),
      array(select jsonb_array_elements_text(item -> 'professionalRequirements')), 'bbw_template', true
    )
    on conflict (external_code) do update set
      name = excluded.name, category_id = excluded.category_id, description = excluded.description,
      body_area = excluded.body_area, default_points = excluded.default_points, default_price_cents = excluded.default_price_cents,
      default_duration_min_minutes = excluded.default_duration_min_minutes,
      default_duration_max_minutes = excluded.default_duration_max_minutes, duration_label = excluded.duration_label,
      professional_requirements = excluded.professional_requirements, is_active = true,
      updated_at = timezone('utc', now())
    where public.catalog_treatments.source = 'bbw_template';
  end loop;

  update public.catalog_treatments
  set is_active = false, updated_at = timezone('utc', now())
  where is_active and source = 'bbw_template' and not (external_code = any(incoming_codes));
  update public.treatment_categories
  set is_active = false, updated_at = timezone('utc', now())
  where is_active and not (code = any(incoming_category_codes));

  return jsonb_build_object('categories', cardinality(incoming_category_codes), 'treatments', cardinality(incoming_codes));
end;
$$;

-- Dropping/recreating the relationship list functions above removes prior EXECUTE grants.
revoke all on function public.list_organization_patient_relationships(uuid) from public, anon, authenticated;
revoke all on function public.list_professional_patient_relationships(uuid) from public, anon, authenticated;
grant execute on function public.list_organization_patient_relationships(uuid) to service_role;
grant execute on function public.list_professional_patient_relationships(uuid) to service_role;

-- Direct table reads are intentionally disabled: canonical catalog access is
-- served through the context-authorized backend RPC path above.
revoke select on public.catalog_treatments from authenticated;

create or replace function public.reject_deleted_patient_relationship()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if exists (
    select 1 from public.subjects subject
    where subject.id = new.subject_id and subject.deleted_at is not null
  ) then
    raise exception 'PATIENT_SUBJECT_DELETED';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_patient_relationship_subject_lifecycle on public.organization_patient_relationships;
create trigger organization_patient_relationship_subject_lifecycle
before insert or update on public.organization_patient_relationships
for each row execute function public.reject_deleted_patient_relationship();

drop trigger if exists professional_patient_relationship_subject_lifecycle on public.professional_patient_relationships;
create trigger professional_patient_relationship_subject_lifecycle
before insert or update on public.professional_patient_relationships
for each row execute function public.reject_deleted_patient_relationship();
