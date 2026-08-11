-- /auth/me reads the profile graph through PostgREST. Keep these grants
-- read-only and server-only; writes remain in dedicated backend services.
GRANT SELECT ON TABLE
  public.user_addresses,
  public.user_business_profiles,
  public.professional_credentials,
  public.professional_studios
TO service_role;

