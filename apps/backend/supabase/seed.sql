-- Synthetic local seed for the canonical foundation.

insert into public.organization_types (code, display_name)
values
  ('clinic', 'Clinica'),
  ('beauty_studio', 'Studio beauty'),
  ('accounting_firm', 'Studio commercialista'),
  ('company', 'Azienda'),
  ('network', 'Rete'),
  ('other', 'Altra organizzazione')
on conflict (code) do update
set display_name = excluded.display_name,
    is_active = true;

insert into public.professional_types (code, category, display_name, verification_required)
values
  ('physician', 'healthcare', 'Medico', true),
  ('healthcare_professional', 'healthcare', 'Professionista sanitario', true),
  ('beauty_professional', 'beauty', 'Professionista beauty', true),
  ('accountant', 'business', 'Commercialista', true),
  ('commercial_agent', 'business', 'Commerciale', false),
  ('other', 'other', 'Altro professionista', true)
on conflict (code) do update
set category = excluded.category,
    display_name = excluded.display_name,
    verification_required = excluded.verification_required,
    is_active = true;

insert into public.roles (code, display_name, scope, is_system)
values
  ('platform_admin', 'Platform administrator', 'platform', true),
  ('account_holder', 'Account holder', 'platform', true),
  ('organization_owner', 'Organization owner', 'organization', true),
  ('organization_admin', 'Organization administrator', 'organization', true),
  ('clinical_director', 'Clinical director', 'organization', true),
  ('practitioner', 'Practitioner', 'organization', true),
  ('office_manager', 'Office manager', 'organization', true),
  ('finance', 'Finance', 'organization', true),
  ('staff', 'Staff', 'organization', true),
  ('customer', 'Customer', 'organization', true)
on conflict (code) do update
set display_name = excluded.display_name,
    scope = excluded.scope,
    is_active = true;

insert into public.permissions (code, display_name, description, is_sensitive)
values
  ('dashboard.access', 'Access dashboard', 'Access the authenticated dashboard', false),
  ('platform.admin.access', 'Platform administration', 'Access platform administration tools', true),
  ('profile.read_own', 'Read own profile', 'Read the current account profile', false),
  ('profile.update_own', 'Update own profile', 'Update the current account profile', false),
  ('organization.create', 'Create organization', 'Create an organization context', false),
  ('organization.read', 'Read organization', 'Read an authorized organization', false),
  ('organization.update', 'Update organization', 'Update an authorized organization', false),
  ('organization.members.read', 'Read members', 'Read members in an authorized organization', true),
  ('organization.members.invite', 'Invite members', 'Invite members within an authorized organization', true),
  ('organization.members.manage', 'Manage members', 'Manage membership and roles within an authorized organization', true),
  ('patients.read', 'Read patients', 'Read active patient relationships in the current context', true),
  ('patients.link', 'Link patients', 'Link an existing BBW patient to the current context', true),
  ('patients.unlink', 'Unlink patients', 'Remove a patient relationship from the current context', true),
  ('professional_profile.create', 'Create professional profile', 'Create a professional profile for the current account', false),
  ('professional_profile.read_own', 'Read own professional profile', 'Read the current professional profile', false),
  ('professional_profile.update_own', 'Update own professional profile', 'Update the current professional profile', false),
  ('professional_profile.verify', 'Verify professional profile', 'Verify professional credentials', true),
  ('audit.read', 'Read audit events', 'Read audit events within an authorized scope', true)
on conflict (code) do update
set display_name = excluded.display_name,
    description = excluded.description,
    is_sensitive = excluded.is_sensitive;

with role_permissions_seed (role_code, permission_code) as (
  values
    ('platform_admin', 'platform.admin.access'),
    ('platform_admin', 'dashboard.access'),
    ('platform_admin', 'profile.read_own'),
    ('platform_admin', 'profile.update_own'),
    ('platform_admin', 'organization.read'),
    ('platform_admin', 'audit.read'),
    ('account_holder', 'dashboard.access'),
    ('account_holder', 'profile.read_own'),
    ('account_holder', 'profile.update_own'),
    ('organization_owner', 'dashboard.access'),
    ('organization_owner', 'profile.read_own'),
    ('organization_owner', 'profile.update_own'),
    ('organization_owner', 'organization.create'),
    ('organization_owner', 'organization.read'),
    ('organization_owner', 'organization.update'),
    ('organization_owner', 'organization.members.read'),
    ('organization_owner', 'organization.members.invite'),
    ('organization_owner', 'organization.members.manage'),
    ('organization_owner', 'patients.read'),
    ('organization_owner', 'patients.link'),
    ('organization_owner', 'patients.unlink'),
    ('organization_admin', 'dashboard.access'),
    ('organization_admin', 'profile.read_own'),
    ('organization_admin', 'profile.update_own'),
    ('organization_admin', 'organization.read'),
    ('organization_admin', 'organization.update'),
    ('organization_admin', 'organization.members.read'),
    ('organization_admin', 'organization.members.invite'),
    ('organization_admin', 'organization.members.manage'),
    ('organization_admin', 'patients.read'),
    ('organization_admin', 'patients.link'),
    ('organization_admin', 'patients.unlink'),
    ('clinical_director', 'dashboard.access'),
    ('clinical_director', 'profile.read_own'),
    ('clinical_director', 'profile.update_own'),
    ('clinical_director', 'organization.read'),
    ('clinical_director', 'organization.members.read'),
    ('clinical_director', 'patients.read'),
    ('clinical_director', 'patients.link'),
    ('clinical_director', 'patients.unlink'),
    ('practitioner', 'dashboard.access'),
    ('practitioner', 'profile.read_own'),
    ('practitioner', 'profile.update_own'),
    ('practitioner', 'organization.read'),
    ('office_manager', 'dashboard.access'),
    ('office_manager', 'profile.read_own'),
    ('office_manager', 'profile.update_own'),
    ('office_manager', 'organization.read'),
    ('office_manager', 'organization.members.read'),
    ('finance', 'dashboard.access'),
    ('finance', 'profile.read_own'),
    ('finance', 'profile.update_own'),
    ('finance', 'organization.read'),
    ('staff', 'dashboard.access'),
    ('staff', 'profile.read_own'),
    ('staff', 'profile.update_own'),
    ('staff', 'organization.read'),
    ('customer', 'dashboard.access'),
    ('customer', 'profile.read_own'),
    ('customer', 'profile.update_own')
)
insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from role_permissions_seed mapping
join public.roles role_record on role_record.code = mapping.role_code
join public.permissions permission_record on permission_record.code = mapping.permission_code
on conflict (role_id, permission_id) do nothing;
