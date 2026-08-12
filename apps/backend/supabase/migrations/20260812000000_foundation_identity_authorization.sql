-- BBW foundation: identity, profiles, organizations, professionals and access.
-- This is the new canonical baseline. Legacy migrations are preserved under
-- supabase/migrations-legacy and are not applied by a fresh database.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  onboarding_intent text,
  onboarding_status text not null default 'profile_required',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_onboarding_intent_check check (
    onboarding_intent is null
    or onboarding_intent in ('personal', 'professional', 'organization', 'commercial')
  ),
  constraint profiles_onboarding_status_check check (
    onboarding_status in ('profile_required', 'context_required', 'completed', 'suspended')
  ),
  constraint profiles_completed_data_check check (
    onboarding_status <> 'completed'
    or (
      btrim(coalesce(first_name, '')) <> ''
      and btrim(coalesce(last_name, '')) <> ''
      and onboarding_intent is not null
    )
  )
);

create table public.organization_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organization_types_code_check check (code ~ '^[a-z0-9_]+$'),
  constraint organization_types_display_name_check check (btrim(display_name) <> '')
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  organization_type_id uuid not null references public.organization_types (id) on delete restrict,
  legal_name text,
  display_name text not null,
  status text not null default 'pending',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizations_status_check check (
    status in ('pending', 'active', 'suspended', 'archived')
  ),
  constraint organizations_display_name_check check (btrim(display_name) <> ''),
  constraint organizations_legal_name_check check (
    legal_name is null or btrim(legal_name) <> ''
  )
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'pending',
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organization_members_unique_membership unique (organization_id, user_id),
  constraint organization_members_status_check check (
    status in ('pending', 'active', 'suspended', 'revoked')
  ),
  constraint organization_members_joined_at_check check (
    status not in ('active', 'suspended') or joined_at is not null
  )
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  scope text not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roles_code_check check (code ~ '^[a-z0-9_]+$'),
  constraint roles_scope_check check (scope in ('platform', 'organization')),
  constraint roles_display_name_check check (btrim(display_name) <> '')
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  description text,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint permissions_code_check check (code ~ '^[a-z0-9_]+([.][a-z0-9_]+)+$'),
  constraint permissions_display_name_check check (btrim(display_name) <> '')
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_id)
);

create table public.member_roles (
  organization_member_id uuid not null references public.organization_members (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organization_member_id, role_id)
);

create table public.account_roles (
  user_id uuid not null references auth.users (id) on delete restrict,
  role_id uuid not null references public.roles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role_id)
);

create table public.professional_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null,
  display_name text not null,
  verification_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint professional_types_code_check check (code ~ '^[a-z0-9_]+$'),
  constraint professional_types_category_check check (
    category in ('healthcare', 'beauty', 'business', 'other')
  ),
  constraint professional_types_display_name_check check (btrim(display_name) <> '')
);

create table public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  professional_type_id uuid not null references public.professional_types (id) on delete restrict,
  display_name text,
  bio text,
  verification_status text not null default 'draft',
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint professional_profiles_unique_type unique (user_id, professional_type_id),
  constraint professional_profiles_status_check check (
    verification_status in ('draft', 'pending', 'verified', 'rejected', 'suspended')
  ),
  constraint professional_profiles_verified_at_check check (
    verification_status <> 'verified' or verified_at is not null
  )
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  subject_kind text not null,
  user_id uuid references auth.users (id) on delete restrict,
  organization_id uuid references public.organizations (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subjects_kind_check check (subject_kind in ('person', 'organization')),
  constraint subjects_owner_check check (
    (subject_kind = 'person' and user_id is not null and organization_id is null)
    or (subject_kind = 'organization' and user_id is null and organization_id is not null)
  ),
  constraint subjects_user_unique unique (user_id),
  constraint subjects_organization_unique unique (organization_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  email text not null,
  role_id uuid not null references public.roles (id) on delete restrict,
  invited_by uuid not null references auth.users (id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint invitations_status_check check (
    status in ('pending', 'accepted', 'expired', 'revoked')
  ),
  constraint invitations_email_check check (position('@' in email) > 1)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_events_action_check check (btrim(action) <> ''),
  constraint audit_events_resource_type_check check (btrim(resource_type) <> '')
);

create index profiles_onboarding_idx on public.profiles (onboarding_status, onboarding_intent);
create index organization_types_active_idx on public.organization_types (is_active, code);
create index organizations_type_idx on public.organizations (organization_type_id);
create index organizations_status_idx on public.organizations (status);
create index organization_members_user_idx on public.organization_members (user_id, status);
create index organization_members_organization_idx on public.organization_members (organization_id, status);
create index roles_scope_active_idx on public.roles (scope, is_active);
create index permissions_code_idx on public.permissions (code);
create index role_permissions_permission_idx on public.role_permissions (permission_id);
create index member_roles_role_idx on public.member_roles (role_id);
create index account_roles_role_idx on public.account_roles (role_id);
create index professional_profiles_user_idx on public.professional_profiles (user_id, verification_status);
create index professional_profiles_type_idx on public.professional_profiles (professional_type_id, verification_status);
create index invitations_email_idx on public.invitations (lower(email), status);
create index invitations_organization_idx on public.invitations (organization_id, status);
create index audit_events_actor_idx on public.audit_events (actor_user_id, created_at desc);
create index audit_events_organization_idx on public.audit_events (organization_id, created_at desc);

create or replace function public.validate_member_role_scope()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  assigned_scope text;
begin
  select scope into assigned_scope from public.roles where id = new.role_id;
  if assigned_scope is distinct from 'organization' then
    raise exception 'Only organization roles can be assigned to organization members';
  end if;
  return new;
end;
$$;

create trigger member_roles_scope_validation
before insert or update on public.member_roles
for each row execute function public.validate_member_role_scope();

create or replace function public.validate_account_role_scope()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  assigned_scope text;
begin
  select scope into assigned_scope from public.roles where id = new.role_id;
  if assigned_scope is distinct from 'platform' then
    raise exception 'Only platform roles can be assigned directly to an account';
  end if;
  return new;
end;
$$;

create trigger account_roles_scope_validation
before insert or update on public.account_roles
for each row execute function public.validate_account_role_scope();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  insert into public.subjects (subject_kind, user_id)
  values ('person', new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create trigger profiles_set_updated_at
before update on public.profiles for each row execute function public.set_updated_at();
create trigger organization_types_set_updated_at
before update on public.organization_types for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at
before update on public.organizations for each row execute function public.set_updated_at();
create trigger organization_members_set_updated_at
before update on public.organization_members for each row execute function public.set_updated_at();
create trigger roles_set_updated_at
before update on public.roles for each row execute function public.set_updated_at();
create trigger permissions_set_updated_at
before update on public.permissions for each row execute function public.set_updated_at();
create trigger role_permissions_set_updated_at
before update on public.role_permissions for each row execute function public.set_updated_at();
create trigger member_roles_set_updated_at
before update on public.member_roles for each row execute function public.set_updated_at();
create trigger account_roles_set_updated_at
before update on public.account_roles for each row execute function public.set_updated_at();
create trigger professional_types_set_updated_at
before update on public.professional_types for each row execute function public.set_updated_at();
create trigger professional_profiles_set_updated_at
before update on public.professional_profiles for each row execute function public.set_updated_at();
create trigger subjects_set_updated_at
before update on public.subjects for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at
before update on public.invitations for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.organization_types enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.account_roles enable row level security;
alter table public.professional_types enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using (user_id = (select auth.uid()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy organization_types_select_active on public.organization_types
for select to authenticated using (is_active);

create policy organizations_select_member on public.organizations
for select to authenticated using (
  exists (
    select 1 from public.organization_members membership
    where membership.organization_id = organizations.id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
);

create policy organization_members_select_own on public.organization_members
for select to authenticated using (user_id = (select auth.uid()));

create policy organization_members_select_same_org on public.organization_members
for select to authenticated using (
  exists (
    select 1 from public.organization_members own_membership
    where own_membership.organization_id = organization_members.organization_id
      and own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
  )
);

create policy roles_select_active on public.roles
for select to authenticated using (is_active);

create policy permissions_select_active on public.permissions
for select to authenticated using (
  exists (
    select 1 from public.role_permissions mapping
    join public.roles role_record on role_record.id = mapping.role_id
    where mapping.permission_id = permissions.id and role_record.is_active
  )
);

create policy role_permissions_select_active on public.role_permissions
for select to authenticated using (
  exists (
    select 1 from public.roles role_record
    where role_record.id = role_permissions.role_id and role_record.is_active
  )
);

create policy member_roles_select_own on public.member_roles
for select to authenticated using (
  exists (
    select 1 from public.organization_members membership
    where membership.id = member_roles.organization_member_id
      and membership.user_id = (select auth.uid())
  )
);

create policy account_roles_select_own on public.account_roles
for select to authenticated using (user_id = (select auth.uid()));

create policy professional_types_select_active on public.professional_types
for select to authenticated using (is_active);

create policy professional_profiles_select_own on public.professional_profiles
for select to authenticated using (user_id = (select auth.uid()));

create policy subjects_select_own on public.subjects
for select to authenticated using (user_id = (select auth.uid()));

create policy audit_events_select_own on public.audit_events
for select to authenticated using (actor_user_id = (select auth.uid()));

revoke all on public.profiles, public.organizations, public.organization_members,
  public.roles, public.permissions, public.role_permissions, public.member_roles,
  public.account_roles, public.professional_types, public.professional_profiles,
  public.subjects, public.invitations, public.audit_events from anon;

revoke all on public.profiles, public.organizations, public.organization_members,
  public.roles, public.permissions, public.role_permissions, public.member_roles,
  public.account_roles, public.professional_types, public.professional_profiles,
  public.subjects, public.invitations, public.audit_events from authenticated;

grant select on public.organization_types, public.roles, public.permissions,
  public.role_permissions, public.professional_types to authenticated;
grant select, update (first_name, last_name, phone, onboarding_intent, onboarding_status)
  on public.profiles to authenticated;
grant select on public.organizations, public.organization_members,
  public.member_roles, public.account_roles, public.professional_profiles,
  public.subjects, public.audit_events to authenticated;

grant select, insert, update, delete on public.profiles, public.organization_types,
  public.organizations, public.organization_members, public.roles, public.permissions,
  public.role_permissions, public.member_roles, public.account_roles,
  public.professional_types, public.professional_profiles, public.subjects,
  public.invitations to service_role;
grant select, insert on public.audit_events to service_role;
revoke update, delete on public.audit_events from service_role;
