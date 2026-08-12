-- Canonical data required to derive profile and organization operational readiness.
-- Readiness itself is computed by the backend and is never persisted as an authorization flag.

alter table public.profiles
  add column birth_date date,
  add column tax_code text,
  add column residential_address jsonb;

alter table public.profiles
  add constraint profiles_tax_code_check check (
    tax_code is null or btrim(tax_code) <> ''
  ),
  add constraint profiles_residential_address_object_check check (
    residential_address is null or jsonb_typeof(residential_address) = 'object'
  );

alter table public.organizations
  add column tax_identifier text,
  add column email text,
  add column phone text,
  add column registered_address jsonb;

alter table public.organizations
  add constraint organizations_tax_identifier_check check (
    tax_identifier is null or btrim(tax_identifier) <> ''
  ),
  add constraint organizations_email_check check (
    email is null or position('@' in email) > 1
  ),
  add constraint organizations_phone_check check (
    phone is null or btrim(phone) <> ''
  ),
  add constraint organizations_registered_address_object_check check (
    registered_address is null or jsonb_typeof(registered_address) = 'object'
  );

-- New sensitive columns intentionally receive no authenticated UPDATE grant.
-- They are changed by verified backend routes so sensitive updates can be audited.
