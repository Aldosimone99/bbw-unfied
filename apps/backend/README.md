# BBW Backend

API Express/TypeScript derivata da `bbw-transition` e backend operativo del
monorepo BBW Unified.

La documentazione architetturale non vive qui: la fonte di verità è il
`../../.kiro/steering/` root. Prima di modificare il backend leggere il
`../../AGENTS.md` e tutti gli steering file.

## Avvio locale

Dal root del repository:

```bash
cp apps/backend/.env.example apps/backend/.env.local
cd apps/backend
npx supabase start
npx supabase status
cd ../..
npm run dev:backend
```

Il backend ascolta su <http://localhost:3001>. Redis deve essere disponibile
all'URL indicato da `REDIS_URL`; Supabase deve essere configurato con la
`SUPABASE_SERVICE_ROLE_KEY` server-side del progetto locale corretto.

Le migration, il seed e i test SQL sono in `apps/backend/supabase/`. Il seed è
sintetico: non inserire dati reali o credenziali.

## Confini

- Le route validano e traducono HTTP.
- I servizi applicano regole di dominio e autorizzazione.
- Il data access usa Supabase/PostgreSQL senza esporre la service-role key.
- Le route protette richiedono Bearer token verificato.
- Il tipo richiesto in onboarding non equivale a un ruolo o a una permission.
