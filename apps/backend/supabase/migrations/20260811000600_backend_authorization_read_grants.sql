-- The backend authorization context is resolved with the server-only
-- service_role client. Keep these grants read-only and limited to the
-- relationship data needed to calculate memberships and permissions.
GRANT SELECT ON TABLE public.companies, public.company_members TO service_role;
