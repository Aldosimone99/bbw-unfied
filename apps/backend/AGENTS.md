# Backend instructions

The source of truth for this monorepo is the root `.kiro/steering/` directory.
Read the root `AGENTS.md` and all steering files before implementing changes.

Backend-specific boundaries:

- Express routes validate and translate HTTP; domain rules stay in services.
- Supabase service-role access is server-only and requires verified bearer auth
  for protected routes.
- `apps/backend/supabase/migrations` is the operational schema source of truth.
- Seeds must be synthetic and must never contain production data or credentials.
- Run `npm run typecheck`, `npm test`, and `npm run build` from the root before
  handing off backend changes.
