-- Backfill the canonical patient permissions for databases initialized before the patient module seed.
-- Keep the role mapping permission-based and idempotent for existing deployments.

insert into public.permissions (code, display_name, description, is_sensitive)
values
  ('patients.read', 'Read patients', 'Read active patient relationships in the current context', true),
  ('patients.link', 'Link patients', 'Link an existing BBW patient to the current context', true),
  ('patients.invite', 'Invite patients', 'Invite a BBW patient to create a relationship with the current organization', true),
  ('patients.unlink', 'Unlink patients', 'Remove a patient relationship from the current context', true)
on conflict (code) do update
set display_name = excluded.display_name,
    description = excluded.description,
    is_sensitive = excluded.is_sensitive;

with role_permissions_seed (role_code, permission_code) as (
  values
    ('organization_owner', 'patients.read'),
    ('organization_owner', 'patients.link'),
    ('organization_owner', 'patients.invite'),
    ('organization_owner', 'patients.unlink'),
    ('organization_admin', 'patients.read'),
    ('organization_admin', 'patients.link'),
    ('organization_admin', 'patients.invite'),
    ('organization_admin', 'patients.unlink'),
    ('clinical_director', 'patients.read'),
    ('clinical_director', 'patients.link'),
    ('clinical_director', 'patients.unlink'),
    ('office_manager', 'patients.read'),
    ('office_manager', 'patients.invite')
)
insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from role_permissions_seed mapping
join public.roles role_record on role_record.code = mapping.role_code
join public.permissions permission_record on permission_record.code = mapping.permission_code
on conflict (role_id, permission_id) do nothing;
