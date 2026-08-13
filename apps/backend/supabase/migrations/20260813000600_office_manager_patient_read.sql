-- Allow the existing office-manager patient invitation capability to reach
-- the permission-scoped patients page without changing route authorization.

with role_permissions_seed (role_code, permission_code) as (
  values ('office_manager', 'patients.read')
)
insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from role_permissions_seed mapping
join public.roles role_record on role_record.code = mapping.role_code
join public.permissions permission_record on permission_record.code = mapping.permission_code
on conflict (role_id, permission_id) do nothing;
