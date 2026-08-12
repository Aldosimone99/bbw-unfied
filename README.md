# BBW Unified

Beauty Broker World is a monorepo that combines the `bbwlanding` frontend with
the operational backend from `bbw-transition`.

The current foundation is intentionally account-first: a person creates a
minimal account, signs in, completes onboarding, and only then selects the
context in which they want to use BBW. The selected context is descriptive
intent; it is not itself a role or permission.

## Repository layout

- `apps/next` — Next.js frontend, marketing landing, auth, onboarding and platform UI.
- `apps/backend` — Express/TypeScript API, domain services and Supabase migrations.
- `packages/interfaces` — shared Zod schemas and TypeScript contracts.
- `apps/backend/supabase` — local Supabase configuration, migrations, seed and SQL regressions.
- `.kiro/steering` — the single source of truth for product, architecture, domain, security and AI contribution rules.

The domain vocabulary is deliberate: `Account`, `Profile`, `Organization`,
`OrganizationMembership`, `Role`, `Permission` and `Subject` are different
concepts. Labels such as “client”, “clinic” or “professional” must never be
used as authorization evidence.

## Prerequisites

- Node.js and npm
- Docker Desktop
- Supabase CLI
- Redis, either locally or through the included Docker command

Install dependencies from the repository root:

```bash
npm install
```

## Local configuration

Create the local environment files from their examples:

```bash
cp apps/next/.env.example apps/next/.env.local
cp apps/backend/.env.example apps/backend/.env.local
```

Start Supabase from the backend project directory. The directory matters:
running Supabase commands from the repository root can inspect the wrong
project configuration.

```bash
cd apps/backend
npx supabase start
npx supabase status
```

Use the local `API_URL` and `PUBLISHABLE_KEY` from `supabase status` in
`apps/next/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BBW_BACKEND_URL=http://localhost:3001
```

Use the server-only service-role key from the same local project only as
`SUPABASE_SERVICE_ROLE_KEY` in `apps/backend/.env.local`. Never expose it to
the browser or commit it. Set the local publishable/anon key separately as
`SUPABASE_ANON_KEY`; the backend uses it only for password login so a
service-role client never establishes a user session.

The backend also defaults to:

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:3000
JSON_BODY_LIMIT=1mb
ENABLE_LEGACY_TRANSITION_ROUTES=false
```

Transition routes are intentionally unavailable until their schema,
authorization and tests have been ported to the canonical model.

Start Redis once, if it is not already running:

```bash
docker run --name bbw-redis -p 6379:6379 -d redis:7-alpine
```

If the container already exists, use `docker start bbw-redis` instead of
creating it again.

## Run the application

From the repository root:

```bash
npm run dev
```

The expected local ports are:

- frontend: <http://localhost:3000>
- backend: <http://localhost:3001>

Run only one root dev process at a time. If Next reports that port `3000` is
already in use, or the backend reports `EADDRINUSE` on `3001`, stop the old
process before starting another one:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
kill <old-process-id>
```

For isolated development:

```bash
npm run dev:frontend
npm run dev:backend
```

The complete auth/onboarding flow requires both processes, Supabase and Redis
where the backend feature needs it.

## Account-first authentication

`/registrati` and `/register` collect only:

- email;
- password;
- password confirmation;
- terms and privacy consent.

Email confirmation is disabled only in the local Supabase configuration so the
bootstrap flow does not depend on an email provider. Re-enable and verify it
before staging or production.

The password policy requires at least eight characters, one uppercase letter,
one lowercase letter, one number and one special character.

The backend owns registration and login. After a successful backend login, the
frontend stores the returned Supabase session through the server-side client.
An incomplete account is sent to `/onboarding`, where the user enters personal
data and selects `personal`, `healthcare_professional`,
`beauty_professional`, `organization` or `commercial`. The selection does not
grant a role by itself. Completion is performed by the backend onboarding RPC;
an organization selection creates the organization and owner membership
atomically.

## Frontend/backend boundary

Server-side auth and onboarding services call the backend with the configured
`BBW_BACKEND_URL`. Browser-facing backend calls use the Next bridge at
`/api/backend/*`; the bridge reads the server-side Supabase session and forwards
only a verified Bearer token. The browser never receives the service-role key.

Authorization is calculated by the backend context endpoint and enforced again
by protected backend routes and database policies. The frontend can render the
state it receives, but it cannot grant permissions, choose an actor, or bypass
ownership checks.

## Profile completeness and operational readiness

Onboarding, profile completeness, organization completeness, professional
verification and authorization are distinct states. `GET /auth/context` now
returns a backend-derived `readiness` object for the authenticated account and
for the selected organization context. It reports technical missing-field
identifiers; it does not persist or trust a global `profile_completed` flag.

The personal operational profile requires first name, last name, date of birth,
tax code and a structured residential address. Phone remains optional. An
organization requires legal/display data, its type, tax identifier, contacts,
address and an active member holding the configured `organization.update`
permission. Professional operational readiness is derived from existing
professional profiles, their `verification_required` configuration and their
existing verification status.

The optional `organization_id` query value accepted by `/auth/context` is only
a context selection request: the backend validates it against the verified
account's active membership before returning organization readiness. Future
sensitive routes must enforce authentication, context, permission, readiness
requirements and only then their business operation.

## Database workflow

Migrations live under `apps/backend/supabase/migrations` and are the database
source of truth. Apply a new local migration from that project directory:

```bash
cd apps/backend
npx supabase migration up --local
```

To recreate the local database from zero, intentionally and destructively:

```bash
npx supabase db reset --local
```

This affects only the local Supabase project and removes local users and data.
Do not use a reset command when you intend to preserve local data, and never
use it as a substitute for a reviewed remote migration.

## Verification

From the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs the canonical regression suite. The archived transition tests
remain available for migration work:

```bash
npm run test:legacy --workspace @bbw/backend
```

They are not a release gate until the corresponding module is ported. The
canonical coverage includes registration, login, onboarding, HTTP surface,
CORS, invitations, professional profiles, profile completeness, organization
readiness and migration grants.

### Manual operational-readiness smoke test

Browser E2E is not configured yet. With local Supabase, Redis and both apps
running, verify the following manually:

1. Register an account, complete onboarding and open `/dashboard`.
2. Confirm that dashboard remains accessible and shows the personal-profile
   configuration notice.
3. Open `/profilo`, complete date of birth, tax code and residential address,
   then save; after refresh the personal blocker disappears from dashboard.
4. For an organization owner, select the organization context, open
   `/organizzazione`, complete legal/contact/address fields, then save; after
   refresh the organization readiness becomes complete for that context only.
5. Switch to another organization and confirm its readiness is calculated from
   its own data, not copied from the previous organization.

## Documentation and contribution rules

Before changing code, read [`AGENTS.md`](./AGENTS.md) and every steering file
from `.kiro/steering/00-product.md` through
`.kiro/steering/14-monorepo-integration.md`. App-level `AGENTS.md` files add
local boundaries; they do not create a second steering tree.

Useful references:

- [Foundation roadmap](./docs/foundation-roadmap.md)
- [Canonical domain model](./docs/canonical-domain-model.md)
- [Transition module inventory](./docs/transition-module-inventory.md)
- [Architecture steering](./.kiro/steering/01-architecture.md)
- [Domain model steering](./.kiro/steering/02-domain-model.md)
- [Database steering](./.kiro/steering/03-database.md)
- [Auth and permissions steering](./.kiro/steering/04-auth-and-permissions.md)
- [Identity and authorization change log](./docs/identity-and-authorization.md)
