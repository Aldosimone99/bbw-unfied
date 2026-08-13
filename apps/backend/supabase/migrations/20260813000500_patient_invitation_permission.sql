-- Provision the patient invitation permission for existing deployments.
-- Keep this idempotent so it is safe on databases that were already seeded.

insert into public.permissions (code, display_name, description, is_sensitive)
values (
  'patients.invite',
  'Invite patients',
  'Invite a BBW patient to create a relationship with the current organization',
  true
)
on conflict (code) do update
set display_name = excluded.display_name,
    description = excluded.description,
    is_sensitive = excluded.is_sensitive;

with role_permissions_seed (role_code, permission_code) as (
  values
    ('organization_owner', 'patients.invite'),
    ('organization_admin', 'patients.invite'),
    ('office_manager', 'patients.invite')
)
insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from role_permissions_seed mapping
join public.roles role_record on role_record.code = mapping.role_code
join public.permissions permission_record on permission_record.code = mapping.permission_code
on conflict (role_id, permission_id) do nothing;
