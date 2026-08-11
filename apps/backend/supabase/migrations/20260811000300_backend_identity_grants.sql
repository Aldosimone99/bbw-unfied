-- The Express backend uses the server-only service_role key. The transformed
-- identity tables predate the default privileges declaration. Keep the grant
-- limited to account registration, onboarding, and own-profile reads.
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO service_role;
GRANT SELECT, INSERT ON TABLE public.user_consents TO service_role;

