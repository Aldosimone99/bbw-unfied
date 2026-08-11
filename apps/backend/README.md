# BBW Backend

Express API for the unified BBW workspace.

## Local run

From the repository root:

```bash
cp apps/backend/.env.example apps/backend/.env.local
cd apps/backend
supabase start
cd ../..
npm run dev:backend
```

The API listens on `http://localhost:3001`. Redis must be available at the
`REDIS_URL` configured in `apps/backend/.env.local`.

The backend schema and migrations live in `supabase/`. Do not use production
data as a local seed.
