-- Compatibility marker for the unified migration chain.
--
-- 20260619000000_prod_baseline.sql already creates the legacy public.users table.
-- 20260626000000_transform.sql then creates the split profile tables and applies
-- the operational transformation. Recreating public.users here would make a
-- clean local Supabase start fail with relation "users" already exists.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'public.users must be created by 20260619000000_prod_baseline.sql';
  END IF;
END;
$$;
