-- Keep the requested onboarding context on the account record.
-- It is descriptive data only and never grants a role or membership.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS requested_organization_name TEXT;

