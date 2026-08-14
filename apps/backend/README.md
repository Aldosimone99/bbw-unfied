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
must be the server-only key for this local Supabase project, while
`SUPABASE_ANON_KEY` is used only for password login. Redis must also be
available at the configured `REDIS_URL` when an enabled route requires it.

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
- `GET /auth/context` calculates profile, memberships, selected active organization,
  permissions and backend-derived operational readiness from the verified Bearer
  token. Its optional `organization_id` is validated against active membership;
  it never authorizes an arbitrary organization ID.
- `GET /organizations/:organizationId/profile` and
  `PUT /organizations/:organizationId/profile` read or update legal/contact data
  only after verified membership and `organization.read`/`organization.update`.
  Sensitive updates are audited with field identifiers only.
- `POST /auth/onboarding/profile` saves the first onboarding step.
- `POST /auth/onboarding/complete` completes onboarding through the protected
  `complete_account_onboarding` RPC.

The backend never trusts `userId`, `actorRole`, account labels or organization
IDs from the client as authorization evidence. Protected routes resolve the
user from a verified Bearer token, and the database remains a second security
boundary. Completeness is calculated from canonical profile/organization data;
it is neither persisted as a global boolean nor a substitute for permission or
professional verification.

Legacy transition routes are disabled by default. Keep
`ENABLE_LEGACY_TRANSITION_ROUTES=false` outside an isolated migration
environment. Canonical runtime routes currently cover auth/onboarding,
organization invitations, professional profiles and health checks.

## Database and permissions

Migrations and SQL regressions live in `supabase/`. Active migrations are the
canonical `20260812000000` series; historical transition migrations are kept
under `supabase/migrations-legacy` and are not applied to a fresh database.
The server-only `service_role` client performs trusted domain operations; the
separate anon client performs credential login.

Seeds are synthetic and must never contain production data, credentials,
passwords or raw tokens.

## Verification

From this directory or the root workspace:

```bash
npm run typecheck
npm test
npm run build
```

`npm test` runs the canonical suite. Use `npm run test:legacy` only while
porting an archived transition module; those tests are kept for reference and
are not evidence that the module is currently exposed.

The full workspace also includes frontend and shared-interface checks; use the
root README commands before handoff.


## Domain alignment status

La baseline backend canonica usa Patient/Subject globale, relationship scoped, ProfessionalProfile globale, OperationalContext e permission organization-scoped. Il catalogo BBW è una libreria di template; le TreatmentDefinition custom appartengono direttamente a organization o professional context.

Le route legacy di bookings, availability, slots, consensi e documenti non sono funzionalità canoniche. Restano disabilitate finché non esistono migration, RLS, permission, audit e test coerenti con `docs/domain/decision-register.md`.

Retention, consensi avanzati, pagamenti e documenti avanzati sono **TBD/BLOCKED**.
