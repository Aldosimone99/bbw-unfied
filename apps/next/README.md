# BBW Frontend

Next.js frontend for BBW Unified, derived from `bbwlanding` and connected to
the operational backend from `bbw-transition`.

The repository-level source of truth is `../../.kiro/steering/`. Read
`../../AGENTS.md`, this file and the steering files before changing frontend
code.

## Local development

From the repository root:

```bash
cp apps/next/.env.example apps/next/.env.local
npm run dev:frontend
```

The frontend listens on <http://localhost:3000>. The complete application flow
also needs the backend on `3001` and local Supabase. Use `npm run dev` at the
repository root to start both applications together.

Required public environment variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BBW_BACKEND_URL=http://localhost:3001
```

Never place `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` or another
server secret in this app's public environment or client bundle.

Run only one Next dev process on port `3000`. If the port is occupied, do not
let Next silently move to the backend port; inspect the old process with:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

## Account-first auth flow

`/registrati` and `/register` collect only email, password, password
confirmation and terms/privacy consent. They do not ask whether the account is
a client, professional or clinic.

The frontend Server Action calls the backend for registration and login. After
the backend verifies the credentials, the returned Supabase access/refresh
session is stored through the server-side Supabase client. This avoids a second
independent credential check and keeps the backend as the authentication
authority.

After login, incomplete accounts go to `/onboarding`. The two steps collect
personal data and then a requested experience: `personal`,
`healthcare_professional`, `beauty_professional`, `organization` or
`commercial`. The requested experience is not a role and does not grant
permissions by itself.

Form state is kept in the client component while Server Actions validate input,
so a validation error does not intentionally erase fields already entered.
Local email confirmation is disabled only for bootstrap and must be restored
before staging or production.

## Backend boundary

Browser-facing backend calls use `/api/backend/*`. The Next route bridge reads
the server-side Supabase session and forwards a verified Bearer token. Server
auth/onboarding services may call `BBW_BACKEND_URL` directly because they run
only on the server. The frontend does not import backend services or decide
ownership, roles or permissions.

## Verification

From the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For the architecture, domain, security, UI and integration rules, read the
root `.kiro/steering/` directory.
