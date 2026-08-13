-- First operational patient slice: one global person subject, scoped operational relationships.
-- Clinical data, guest patients and cross-organization sharing are intentionally out of scope.

insert into public.subjects (subject_kind, user_id)
select 'person', profile.user_id
from public.profiles profile
on conflict (user_id) do nothing;

create table public.organization_patient_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  status text not null default 'active',
  created_by uuid not null references auth.users (id) on delete restrict,
  removed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  removed_at timestamptz,
  constraint organization_patient_relationship_status_check check (status in ('active', 'removed')),
  constraint organization_patient_relationship_unique unique (organization_id, subject_id)
);

create table public.professional_patient_relationships (
  id uuid primary key default gen_random_uuid(),
  professional_profile_id uuid not null references public.professional_profiles (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  status text not null default 'active',
  created_by uuid not null references auth.users (id) on delete restrict,
  removed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  removed_at timestamptz,
  constraint professional_patient_relationship_status_check check (status in ('active', 'removed')),
  constraint professional_patient_relationship_unique unique (professional_profile_id, subject_id)
);

create index organization_patient_relationships_subject_idx
  on public.organization_patient_relationships (subject_id, status);
create index organization_patient_relationships_scope_idx
  on public.organization_patient_relationships (organization_id, status, created_at desc);
create index professional_patient_relationships_subject_idx
  on public.professional_patient_relationships (subject_id, status);
create index professional_patient_relationships_scope_idx
  on public.professional_patient_relationships (professional_profile_id, status, created_at desc);

create or replace function public.list_organization_patient_relationships(p_organization_id uuid)
returns table (
  relationship_id uuid,
  subject_id uuid,
  organization_id uuid,
  professional_profile_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  birth_date date,
  status text,
  linked_at timestamptz,
  removed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_SERVICE_ROLE_REQUIRED';
  end if;

  return query
  select
    relationship.id,
    relationship.subject_id,
    relationship.organization_id,
    null::uuid,
    profile.first_name,
    profile.last_name,
    account.email::text,
    profile.phone,
    profile.birth_date,
    relationship.status,
    relationship.created_at,
    relationship.removed_at
  from public.organization_patient_relationships relationship
  join public.subjects subject on subject.id = relationship.subject_id and subject.subject_kind = 'person'
  join public.profiles profile on profile.user_id = subject.user_id
  join auth.users account on account.id = subject.user_id
  where relationship.organization_id = p_organization_id
    and relationship.status = 'active'
  order by relationship.created_at desc, account.email asc;
end;
$$;

create or replace function public.list_professional_patient_relationships(p_professional_profile_id uuid)
returns table (
  relationship_id uuid,
  subject_id uuid,
  organization_id uuid,
  professional_profile_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  birth_date date,
  status text,
  linked_at timestamptz,
  removed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_SERVICE_ROLE_REQUIRED';
  end if;

  return query
  select
    relationship.id,
    relationship.subject_id,
    null::uuid,
    relationship.professional_profile_id,
    profile.first_name,
    profile.last_name,
    account.email::text,
    profile.phone,
    profile.birth_date,
    relationship.status,
    relationship.created_at,
    relationship.removed_at
  from public.professional_patient_relationships relationship
  join public.subjects subject on subject.id = relationship.subject_id and subject.subject_kind = 'person'
  join public.profiles profile on profile.user_id = subject.user_id
  join auth.users account on account.id = subject.user_id
  where relationship.professional_profile_id = p_professional_profile_id
    and relationship.status = 'active'
  order by relationship.created_at desc, account.email asc;
end;
$$;

create or replace function public.lookup_patient_accounts(p_email text default null, p_tax_code text default null)
returns table (
  subject_id uuid,
  user_id uuid,
  email text,
  first_name text,
  last_name text
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_SERVICE_ROLE_REQUIRED';
  end if;
  if ((nullif(btrim(p_email), '') is null) = (nullif(btrim(p_tax_code), '') is null)) then
    raise exception 'PATIENT_LOOKUP_EXACT_IDENTIFIER_REQUIRED';
  end if;

  return query
  select subject.id, subject.user_id, account.email::text, profile.first_name, profile.last_name
  from public.subjects subject
  join public.profiles profile on profile.user_id = subject.user_id
  join auth.users account on account.id = subject.user_id
  where subject.subject_kind = 'person'
    and (
      (nullif(btrim(p_email), '') is not null and lower(account.email) = lower(btrim(p_email)))
      or (nullif(btrim(p_tax_code), '') is not null and upper(profile.tax_code) = upper(btrim(p_tax_code)))
    )
  limit 5;
end;
$$;

create or replace function public.link_organization_patient(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_subject_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  relationship_id uuid;
  subject_kind text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_SERVICE_ROLE_REQUIRED';
  end if;
  if p_actor_user_id is null or p_organization_id is null or p_subject_id is null then
    raise exception 'PATIENT_RELATIONSHIP_INVALID_INPUT';
  end if;
  select subjects.subject_kind into subject_kind from public.subjects where subjects.id = p_subject_id;
  if subject_kind is distinct from 'person' then raise exception 'PATIENT_SUBJECT_NOT_FOUND'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id and status = 'active') then
    raise exception 'PATIENT_ORGANIZATION_NOT_FOUND';
  end if;

  select id, status into relationship_id, subject_kind
  from public.organization_patient_relationships
  where organization_id = p_organization_id and subject_id = p_subject_id
  for update;
  if relationship_id is not null and subject_kind = 'active' then
    raise exception 'PATIENT_RELATIONSHIP_ALREADY_ACTIVE';
  end if;

  if relationship_id is null then
    insert into public.organization_patient_relationships (organization_id, subject_id, created_by)
    values (p_organization_id, p_subject_id, p_actor_user_id)
    returning id into relationship_id;
  else
    update public.organization_patient_relationships
    set status = 'active', created_by = p_actor_user_id, removed_by = null,
        removed_at = null, updated_at = timezone('utc', now())
    where id = relationship_id;
  end if;

  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, p_organization_id, 'patient.relationship.created', 'organization_patient_relationship', relationship_id,
          jsonb_build_object('subject_id', p_subject_id, 'organization_id', p_organization_id));
  return relationship_id;
end;
$$;

create or replace function public.link_professional_patient(
  p_actor_user_id uuid,
  p_professional_profile_id uuid,
  p_subject_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  relationship_id uuid;
  relationship_status text;
  subject_kind text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_SERVICE_ROLE_REQUIRED';
  end if;
  if p_actor_user_id is null or p_professional_profile_id is null or p_subject_id is null then
    raise exception 'PATIENT_RELATIONSHIP_INVALID_INPUT';
  end if;
  select subjects.subject_kind into subject_kind from public.subjects where subjects.id = p_subject_id;
  if subject_kind is distinct from 'person' then raise exception 'PATIENT_SUBJECT_NOT_FOUND'; end if;
  if not exists (select 1 from public.professional_profiles where id = p_professional_profile_id) then
    raise exception 'PATIENT_PROFESSIONAL_PROFILE_NOT_FOUND';
  end if;

  select id, status into relationship_id, relationship_status
  from public.professional_patient_relationships
  where professional_profile_id = p_professional_profile_id and subject_id = p_subject_id
  for update;
  if relationship_id is not null and relationship_status = 'active' then
    raise exception 'PATIENT_RELATIONSHIP_ALREADY_ACTIVE';
  end if;

  if relationship_id is null then
    insert into public.professional_patient_relationships (professional_profile_id, subject_id, created_by)
    values (p_professional_profile_id, p_subject_id, p_actor_user_id)
    returning id into relationship_id;
  else
    update public.professional_patient_relationships
    set status = 'active', created_by = p_actor_user_id, removed_by = null,
        removed_at = null, updated_at = timezone('utc', now())
    where id = relationship_id;
  end if;

  insert into public.audit_events (actor_user_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, 'patient.relationship.created', 'professional_patient_relationship', relationship_id,
          jsonb_build_object('subject_id', p_subject_id, 'professional_profile_id', p_professional_profile_id));
  return relationship_id;
end;
$$;

create or replace function public.remove_organization_patient_relationship(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_relationship_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  relationship_subject_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'PATIENT_SERVICE_ROLE_REQUIRED'; end if;
  update public.organization_patient_relationships
  set status = 'removed', removed_by = p_actor_user_id, removed_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = p_relationship_id and organization_id = p_organization_id and status = 'active'
  returning subject_id into relationship_subject_id;
  if relationship_subject_id is null then raise exception 'PATIENT_RELATIONSHIP_NOT_FOUND'; end if;
  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, p_organization_id, 'patient.relationship.removed', 'organization_patient_relationship', p_relationship_id,
          jsonb_build_object('subject_id', relationship_subject_id, 'organization_id', p_organization_id));
  return p_relationship_id;
end;
$$;

create or replace function public.remove_professional_patient_relationship(
  p_actor_user_id uuid,
  p_professional_profile_id uuid,
  p_relationship_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  relationship_subject_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'PATIENT_SERVICE_ROLE_REQUIRED'; end if;
  update public.professional_patient_relationships
  set status = 'removed', removed_by = p_actor_user_id, removed_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = p_relationship_id and professional_profile_id = p_professional_profile_id and status = 'active'
  returning subject_id into relationship_subject_id;
  if relationship_subject_id is null then raise exception 'PATIENT_RELATIONSHIP_NOT_FOUND'; end if;
  insert into public.audit_events (actor_user_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, 'patient.relationship.removed', 'professional_patient_relationship', p_relationship_id,
          jsonb_build_object('subject_id', relationship_subject_id, 'professional_profile_id', p_professional_profile_id));
  return p_relationship_id;
end;
$$;

alter table public.organization_patient_relationships enable row level security;
alter table public.professional_patient_relationships enable row level security;

create policy organization_patient_relationships_select on public.organization_patient_relationships
for select to authenticated using (
  exists (
    select 1
    from public.organization_members membership
    join public.member_roles member_role on member_role.organization_member_id = membership.id
    join public.role_permissions mapping on mapping.role_id = member_role.role_id
    join public.permissions permission on permission.id = mapping.permission_id
    where membership.organization_id = organization_patient_relationships.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and permission.code = 'patients.read'
  )
);

create policy organization_patient_relationships_insert on public.organization_patient_relationships
for insert to authenticated with check (
  exists (
    select 1
    from public.organization_members membership
    join public.member_roles member_role on member_role.organization_member_id = membership.id
    join public.role_permissions mapping on mapping.role_id = member_role.role_id
    join public.permissions permission on permission.id = mapping.permission_id
    where membership.organization_id = organization_patient_relationships.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and permission.code = 'patients.link'
  )
);

create policy organization_patient_relationships_update on public.organization_patient_relationships
for update to authenticated using (
  exists (
    select 1
    from public.organization_members membership
    join public.member_roles member_role on member_role.organization_member_id = membership.id
    join public.role_permissions mapping on mapping.role_id = member_role.role_id
    join public.permissions permission on permission.id = mapping.permission_id
    where membership.organization_id = organization_patient_relationships.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and permission.code = 'patients.unlink'
  )
) with check (organization_id = organization_patient_relationships.organization_id);

create policy professional_patient_relationships_select on public.professional_patient_relationships
for select to authenticated using (
  exists (
    select 1 from public.professional_profiles professional
    join public.professional_types professional_type on professional_type.id = professional.professional_type_id
    where professional.id = professional_patient_relationships.professional_profile_id
      and professional.user_id = (select auth.uid())
      and professional_type.is_active
      and professional.verification_status not in ('rejected', 'suspended')
      and (not professional_type.verification_required or professional.verification_status = 'verified')
  )
);

create policy professional_patient_relationships_insert on public.professional_patient_relationships
for insert to authenticated with check (
  exists (
    select 1 from public.professional_profiles professional
    join public.professional_types professional_type on professional_type.id = professional.professional_type_id
    where professional.id = professional_patient_relationships.professional_profile_id
      and professional.user_id = (select auth.uid())
      and professional_type.is_active
      and (not professional_type.verification_required or professional.verification_status = 'verified')
  )
);

create policy professional_patient_relationships_update on public.professional_patient_relationships
for update to authenticated using (
  exists (
    select 1 from public.professional_profiles professional
    join public.professional_types professional_type on professional_type.id = professional.professional_type_id
    where professional.id = professional_patient_relationships.professional_profile_id
      and professional.user_id = (select auth.uid())
      and professional_type.is_active
      and (not professional_type.verification_required or professional.verification_status = 'verified')
  )
) with check (professional_profile_id = professional_patient_relationships.professional_profile_id);

revoke all on public.organization_patient_relationships, public.professional_patient_relationships from anon, authenticated;
grant select, insert, update on public.organization_patient_relationships, public.professional_patient_relationships to authenticated;
grant select, insert, update on public.organization_patient_relationships, public.professional_patient_relationships to service_role;
revoke delete on public.organization_patient_relationships, public.professional_patient_relationships from authenticated, service_role;

revoke all on function public.list_organization_patient_relationships(uuid) from public, anon, authenticated;
revoke all on function public.list_professional_patient_relationships(uuid) from public, anon, authenticated;
revoke all on function public.lookup_patient_accounts(text, text) from public, anon, authenticated;
revoke all on function public.link_organization_patient(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.link_professional_patient(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_organization_patient_relationship(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_professional_patient_relationship(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_organization_patient_relationships(uuid) to service_role;
grant execute on function public.list_professional_patient_relationships(uuid) to service_role;
grant execute on function public.lookup_patient_accounts(text, text) to service_role;
grant execute on function public.link_organization_patient(uuid, uuid, uuid) to service_role;
grant execute on function public.link_professional_patient(uuid, uuid, uuid) to service_role;
grant execute on function public.remove_organization_patient_relationship(uuid, uuid, uuid) to service_role;
grant execute on function public.remove_professional_patient_relationship(uuid, uuid, uuid) to service_role;
