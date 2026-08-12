# Backend instructions

The source of truth for this monorepo is the root `.kiro/steering/` directory.
Read the root `AGENTS.md` and all steering files (`00` through `14`) before
implementing changes. Do not create backend-specific steering copies.

Backend-specific boundaries:

- Express routes validate and translate HTTP; domain rules stay in services.
- Supabase service-role access is server-only and requires verified bearer auth
  for protected routes.
- Credential login uses the anon/publishable Supabase client; the service-role
  client must never be used to establish a user session.
- `SUPABASE_SERVICE_ROLE_KEY` must be the server key for the active local
  Supabase project; never use the publishable/anon key in its place.
- `apps/backend/supabase/migrations` is the operational schema source of truth.
- Seeds must be synthetic and must never contain production data or credentials.
- Account registration is intentionally minimal; account type and operational
  context belong to post-login onboarding and do not grant a role by themselves.
- Transition routes remain disabled unless `ENABLE_LEGACY_TRANSITION_ROUTES`
  is explicitly enabled in an isolated migration environment. Never enable
  them in staging or production before their active schema and permissions are
  ported.
- Run `npm run typecheck`, `npm test`, and `npm run build` from the root before
  handing off backend changes.
