# BBW Unified

This project combines the `bbwlanding` frontend with the `bbw-transition` backend.

The repository-level source of truth for architecture and implementation rules
is `.kiro/steering/`. Read all steering files before implementing a feature.

## Layout

- `apps/next`: Next.js frontend derived from `bbwlanding`.
- `apps/backend`: Express API derived from `bbw-transition`.
- `packages/interfaces`: shared Zod schemas and TypeScript contracts.
- `apps/backend/supabase`: backend migrations, seeds and local Supabase config.

## Integration rules

- The frontend reaches the backend through `/api/backend/*`, which forwards the
  Supabase server session as a Bearer token when one exists.
- The backend remains the authority for operational domain rules.
- Do not copy production dumps or real credentials into this repository.
- Keep the Supabase project and user/schema mapping explicit before enabling
  bookings, consents, messaging or company management in the frontend.
- New source filenames use kebab-case unless a framework convention requires a
  different name.
- Do not create a second steering tree inside an app. App-level `AGENTS.md`
  files point back to this root guidance.
