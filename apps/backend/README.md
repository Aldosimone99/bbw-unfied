# BBW Backend

Express/TypeScript backend for BBW Unified, derived from `bbw-transition`.
It owns domain rules, verified authentication context, onboarding completion,
authorization decisions and the operational Supabase schema.

The repository-level source of truth is `../../.kiro/steering/`. Read
`../../AGENTS.md` and the steering files before changing backend code.

## Local development

From the repository root, create the environment files once:

```bash
cp apps/backend/.env.example apps/backend/.env.local
cp apps/next/.env.example apps/next/.env.local
```

Start the local Supabase project from this directory:

```bash
cd apps/backend
npx supabase start
npx supabase status
```

Apply migrations without resetting data:

```bash
npx supabase migration up --local
```

Reset only the local database, when intentionally removing all local data:

```bash
npx supabase db reset --local
```

The backend listens on <http://localhost:3001>. `SUPABASE_SERVICE_ROLE_KEY`
must be the server-only key for this local Supabase project. Redis must also be
available at the configured `REDIS_URL` when a route requires it.

Start the backend alone from the repository root:

```bash
npm run dev:backend
```

Run only one backend process on port `3001`; a second process fails with
`EADDRINUSE`. Use `lsof -nP -iTCP:3001 -sTCP:LISTEN` to find an old process.

## Authentication boundary

- `POST /auth/register` creates a minimal account without an account type.
- `POST /auth/login` verifies credentials and returns the Supabase session used
  by the frontend server-side client.
- `GET /auth/me` returns the verified application profile.
- `GET /auth/context` calculates profile, memberships, active organization and
  permissions from the verified Bearer token.
- `POST /auth/onboarding/profile` saves the first onboarding step.
- `POST /auth/onboarding/complete` completes onboarding through the protected
  `complete_account_onboarding` RPC.

The backend never trusts `userId`, `actorRole`, account labels or organization
IDs from the client as authorization evidence. Protected routes resolve the
user from a verified Bearer token, and the database remains a second security
boundary.

## Database and permissions

Migrations and SQL regressions live in `supabase/`. The backend uses the
server-only `service_role` client. Its read grants are intentionally limited;
for authorization context, migration
`20260811000600_backend_authorization_read_grants.sql` grants read access only
to the relationship data required for memberships and permissions.

Seeds are synthetic and must never contain production data, credentials,
passwords or raw tokens.

## Verification

From this directory or the root workspace:

```bash
npm run typecheck
npm test
npm run build
```

The full workspace also includes frontend and shared-interface checks; use the
root README commands before handoff.
