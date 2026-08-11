# BBW Unified

Unified workspace for Beauty Broker World:

- `apps/next`: the `bbwlanding` Next.js frontend.
- `apps/backend`: the `bbw-transition` Express + TypeScript backend.
- `packages/interfaces`: shared request/response schemas.

## Avvio locale

Prerequisiti: Node.js, Docker, Supabase CLI e Redis.

Dal root del progetto:

```bash
cd /Users/aldosimone/Documents/GitHub/bbw-unified
npm install
cp apps/next/.env.example apps/next/.env.local
cp apps/backend/.env.example apps/backend/.env.local
```

Compila poi i valori Supabase nei due file `.env.local`. Avvia Supabase dalla
cartella backend:

```bash
cd apps/backend
supabase start
```

In un secondo terminale, avvia Redis se non è già attivo:

```bash
docker run --name bbw-redis -p 6379:6379 -d redis:7-alpine
```

Infine, dal root, avvia frontend e backend insieme:

```bash
npm run dev
```

URL locali: frontend `http://localhost:3000`, backend `http://localhost:3001`.
Per avviarli separatamente sono disponibili `npm run dev:frontend` e
`npm run dev:backend`.

The frontend backend bridge is available under `/api/backend/*`. It uses the
Supabase session cookie from the frontend and forwards an access token to the
Express API when the user is signed in.

The operational schema remains under `apps/backend/supabase`. The frontend
identity/organization schema was intentionally not copied as a second migration
tree; the two schemas must be mapped before production use.

The shared steering files are in `.kiro/steering/`. `AGENTS.md` at the root is
the repository-level entry point; app-level `AGENTS.md` files point back to that
single source of truth.
# bbw-unfied
