# BBW Unified

This project combines the `bbwlanding` frontend with the `bbw-transition` backend.

The repository-level source of truth for product, architecture, domain,
security, UI and implementation rules is `.kiro/steering/`. Before implementing
anything, read the root instructions and all steering files from
`00-product.md` through `14-monorepo-integration.md`; use the app-level
`AGENTS.md` only for additional local boundaries.

## Layout

- `apps/next`: Next.js frontend derived from `bbwlanding`.
- `apps/backend`: Express API derived from `bbw-transition`.
- `packages/interfaces`: shared Zod schemas and TypeScript contracts.
- `apps/backend/supabase`: backend migrations, seeds and local Supabase config.
- `.kiro/steering`: one shared steering tree; do not create copies inside apps.

## Integration rules

- The frontend reaches the backend through `/api/backend/*`, which forwards the
  Supabase server session as a Bearer token when one exists.
- The backend remains the authority for operational domain rules.
- Account/Profile/Organization/Membership/Role/Permission/Subject are distinct
  concepts; visible labels such as “cliente” or “clinica” never authorize an
  operation.
- Do not copy production dumps or real credentials into this repository.
- Keep the Supabase project and user/schema mapping explicit before enabling
  bookings, consents, messaging or company management in the frontend.
- New source filenames use kebab-case unless a framework convention requires a
  different name.
- Documentation changes that alter architecture, setup or auth flows must keep
  the relevant steering files, README files and app instructions aligned.
- Do not create a second steering tree inside an app. App-level `AGENTS.md`
  files point back to this root guidance.
