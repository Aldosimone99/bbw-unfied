# BBW Unified

Beauty Broker World is a monorepo that combines the `bbwlanding` frontend with
the operational backend from `bbw-transition`.

The current foundation is intentionally account-first: a person creates a
minimal account, signs in, completes onboarding, and only then works in an
explicit operational context. An operational context identifies the current
workspace; it is not an onboarding intent, role or permission.

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

`GET /auth/context` returns `availableOperationalContexts` and an
`activeOperationalContext`. The HttpOnly `bbw-active-operational-context`
cookie stores only a `{ kind, id }` reference: the backend always validates it
against the authenticated account, professional-profile ownership or active
organization membership before resolving roles, permissions and readiness.
With one available context the post-login flow stores it automatically; with
multiple contexts and no valid preference it redirects to `/seleziona-contesto`.
Future sensitive routes must enforce authentication, context, permission,
readiness requirements and only then their business operation.

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

### Manual organization-invitation multi-context smoke test

This first invitation vertical slice intentionally does **not** send email. The creator receives a raw invitation URL once, immediately after creation or explicit link rotation; the database stores only its hash. Do not copy invitation URLs into logs, tickets or persistent documentation.

Prerequisites: local Supabase and Redis running, migrations applied, and frontend/backend started. Use two different browser profiles so the two Supabase sessions remain isolated.

1. **Browser 1 — Account A, owner:** register and complete onboarding as an organization owner, create/complete `Clinica Aurora`, then enter its organization context through the Context Switcher.
2. Open `/inviti`. The page is available only in an active organization context with `organization.members.invite`. Enter Account B’s email and select **Crea invito**: BBW assigns the organization `practitioner` role server-side and does not expose a role selector.
3. Copy the URL displayed in the temporary *Link invito* panel. Refreshing the page intentionally removes this raw value; from an existing pending invitation use **Genera nuovo link**, which invalidates the old token.
4. **Browser 2 — Account B, physician:** register, complete a verified and active `physician` ProfessionalProfile, and confirm that the Context Switcher only shows the personal workspace. An account without this profile must be rejected with the medical-recipient error when it accepts the invitation.
5. Open the copied `/inviti/accetta?token=…` URL. If Browser 2 is unauthenticated, BBW redirects to `/accedi` and safely returns to the same invitation after login. Verify the page identifies `Clinica Aurora`, the assigned role and its expiry without exposing the invited email or internal IDs.
6. Accept using the same Account B email. An account with another email must receive **Questo invito è destinato a un altro account**. After success, choose **Entra nella clinica** to open `/seleziona-contesto`; BBW does not change the active workspace implicitly.
7. Confirm Account B now has both contexts: the personal professional workspace and `Clinica Aurora`. Log out, then log back in: BBW must clear the saved context and reopen `/seleziona-contesto`. After selecting one context, refresh, navigate, or open a new platform page; it must retain that selection for the active session. Switch to `Clinica Aurora` and verify `activeOperationalContext.kind = organization`, the organization membership role and only that context’s operational permissions. Switch back to the personal workspace and verify those organization permissions disappear.
8. **Browser 1:** open `/membri` in `Clinica Aurora`. The primary list and its counter must show only active members. The owner has no removal action. Remove Account B after confirming the dialog: the row and counter disappear immediately after refresh; Account B loses `Clinica Aurora` from the Context Switcher on its next request while retaining the personal workspace. A manual request cannot remove the last `organization_owner`.
9. Still in Browser 1, invite Account B again. The new invitation must be created despite the historical accepted invitation and revoked membership. In Browser 2 accept it: BBW reactivates the existing membership, restores only the `practitioner` role, shows `Clinica Aurora` once in the Context Switcher and shows Account B once in the active member list.
10. In `/inviti`, revoke a pending invitation and verify its link fails. For accepted, revoked or expired records use **Rimuovi dalla cronologia**; it must disappear from the visible history while audit remains. Use **Pulisci cronologia** and confirm that completed records disappear while every valid pending invitation remains visible and usable.

Before handing off a local change, run from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
