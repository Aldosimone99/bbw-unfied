# Identity & Authorization — Change Log

This document records important changes to identity, registration, sessions,
onboarding and authorization. Update it whenever one of these boundaries or
the related Supabase migrations changes.

## Current source of truth

Last reviewed: 2026-08-11

For the unified monorepo, `apps/backend` and its Supabase migrations are the
authoritative source for registration, application profiles, onboarding,
memberships and permissions. `apps/next` collects input, establishes the SSR
session and renders the context returned by the backend. The old identity model
from `bbwlanding` is not maintained as a second source of truth.

Use these terms consistently:

- `Account` — authenticated Supabase Auth identity;
- `Profile` — application data attached to the account;
- `Organization` — collective operational context;
- `OrganizationMembership` — account-to-organization relationship;
- `Role` and `Permission` — authorization concepts;
- `Subject` — person or entity to which a domain record refers.

Do not use `User` as a universal domain model, and do not infer authorization
from labels such as “client”, “professional” or “clinic”.

## Implemented flow

```text
minimal registration
  → backend-created Auth account + neutral application profile
  → backend login returns Supabase session
  → Next stores the session server-side
  → /onboarding profile step
  → /onboarding requested-experience step
  → protected transactional completion
  → /dashboard
```

Initial registration requires only email, password, password confirmation and
terms/privacy consent. It does not ask for account type, organization, name or
tax data. The password policy is eight or more characters with uppercase,
lowercase, number and special character.

Email confirmation is disabled only in the local Supabase configuration for
bootstrap. It must be restored before staging or production.

## Session handoff

`POST /auth/login` is the backend authentication authority. It verifies the
application account and Supabase credentials, then returns an access token and
refresh token. The Next auth service calls `supabase.auth.setSession(...)` with
those tokens through the server-side client. It no longer performs a second
independent `signInWithPassword` request.

Registration creates the account first, then uses the same backend login path
to establish the session. If the session cannot be established, the account
may already exist and the user can retry from `/accedi`; the backend never
stores a plaintext password after the Auth provider call.

## Onboarding

The first step saves name, surname and optional phone and changes
`users.onboarding_status` to `account_type_required`.

The second step accepts one of:

- `personal` (shown as “Cliente”);
- `healthcare_professional` (shown as “Medico”);
- `beauty_professional` (shown as “Estetista”);
- `organization` (shown as “Clinica”);
- `commercial` (shown as “Commerciale”).

The requested experience is stored as `requested_account_type`. It is
descriptive intent, not a role, permission or proof of professional status.
For `organization`, the protected RPC creates the organization and owner
membership atomically and then marks onboarding complete. For personal and
other requested experiences, completion grants only the baseline dashboard
access represented by the backend context; operational enablement remains a
separate workflow.

## Backend authorization context

`GET /auth/context` requires a verified Bearer token. It returns:

- the verified application account;
- the normalized profile and onboarding status;
- active organization memberships;
- active organization;
- global permissions;
- organization-scoped permissions;
- the combined permission list.

The backend calculates this context from the verified identity and database
state. The browser cannot submit an actor ID, role, permission or organization
ID to obtain access. Protected routes repeat authentication and ownership
checks rather than trusting UI state.

## Database migrations

Relevant account-first and authorization migrations are:

- `20260811000100_account_first_onboarding.sql` — neutral account state and
  onboarding columns on `public.users`;
- `20260811000200_onboarding_request_context.sql` — requested organization
  context and server-only profile read grants;
- `20260811000300_backend_identity_grants.sql` — minimal backend grants for
  account/profile registration operations;
- `20260811000400_backend_identity_profile_reads.sql` — read grants for the
  profile graph used by `/auth/me`;
- `20260811000500_authoritative_onboarding_context.sql` — transactional
  onboarding completion RPC;
- `20260811000600_backend_authorization_read_grants.sql` — read-only
  `service_role` access to `companies` and `company_members`, required to
  calculate memberships and permissions.

Apply them only from the backend project directory:

```bash
cd apps/backend
npx supabase migration up --local
```

To recreate local data intentionally:

```bash
npx supabase db reset --local
```

This is destructive for local data and must never be used as an implicit
remote deployment procedure.

## Main files

- `apps/next/src/features/auth/actions.ts` — login, registration and onboarding
  Server Actions;
- `apps/next/src/server/services/auth-service.ts` — backend auth call and SSR
  session handoff;
- `apps/next/src/server/auth/transition-session.ts` — access token, profile and
  authorization-context reads;
- `apps/next/src/app/(auth)/onboarding/page.tsx` — onboarding guard;
- `apps/next/src/features/auth/OnboardingForm.tsx` — two-step form;
- `apps/backend/src/routes/auth/` — auth, profile, context and onboarding routes;
- `apps/backend/src/services/authorization-context-service.ts` — authoritative
  permission context;
- `apps/backend/src/services/account-onboarding-service.ts` — onboarding use
  cases;
- `apps/backend/supabase/migrations/` — schema, grants and RPCs;
- `apps/backend/src/__tests__/services/` — backend auth/onboarding/context tests;
- `apps/next/src/server/services/auth-service.test.ts` — session handoff tests.

## Verification record

The latest verification included:

- backend typecheck and 74 test files / 353 tests;
- frontend typecheck and 11 test files / 53 tests;
- targeted migration grant regression;
- local browser smoke: registration → onboarding → personal/“Cliente” →
  dashboard;
- local database reset with all migrations, ending with zero local users.

## Change log

### 2026-08-11 — Backend-authoritative auth context and session handoff

- Removed the frontend's second independent password sign-in after backend
  authentication.
- Stored the backend-returned Supabase session through the Next SSR client.
- Added the authoritative `/auth/context` backend response for profile,
  memberships and permissions.
- Protected onboarding completion with a service-role-only transactional RPC.
- Added the minimal read-only grants required for `companies` and
  `company_members`.
- Added regressions for successful/failed session handoff and migration grants.
- Verified the complete local personal-account flow in a browser.

### 2026-08-11 — Account-first registration

- Initial registration returned to the `bbwlanding` shape: email, password,
  confirmation and consents only.
- Removed account-type selection from the initial registration page.
- Moved personal data and requested experience to post-login onboarding.
- Disabled email-code confirmation only for local bootstrap.

For future sensitive changes, record date, files, migration, observable
redirects, Auth/profile/role/permission impact, tests and any open decisions.
Never edit an applied migration; create a new numbered migration.
