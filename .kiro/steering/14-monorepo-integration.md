# 14 — Integrazione monorepo

## Struttura

Questo repository unisce `apps/next` (frontend Next.js), `apps/backend` (API
Express) e `packages/interfaces` (contratti Zod e tipi condivisi).

La directory `.kiro/steering/` al root è l'unica fonte di verità per il
monorepo. Non creare copie locali degli steering file dentro le app.

## Avvio

Le variabili runtime restano separate:

- `apps/next/.env.local`: variabili `NEXT_PUBLIC_*`, `NEXT_PUBLIC_SITE_URL` e
  `BBW_BACKEND_URL`;
- `apps/backend/.env.local`: Supabase server-side, Redis, porta e CORS.

La chiave `SUPABASE_SERVICE_ROLE_KEY` resta esclusivamente nel backend e deve
essere la service-role/secret key del progetto locale corretto, mai la chiave
publishable/anon usata dal browser.

`npm run dev` avvia entrambi i processi. Per debug isolato usare
`npm run dev:frontend` o `npm run dev:backend`.

## Confine frontend/backend

Il frontend raggiunge l'API attraverso `/api/backend/[...path]`. Il proxy legge
la sessione Supabase server-side e inoltra un Bearer token al backend; il
browser non deve conservare il service role key né un token backend persistente.

Le schermate ancora basate sulle Server Actions Supabase possono restare
funzionanti durante la migrazione. Una feature va portata alle API Express solo
quando request, response, errori, permission e ownership sono coperti da un
contratto condiviso e da test.

Il percorso account-first attuale è: registrazione minima senza tipo di account,
login automatico locale, onboarding post-login per profilo e tipo richiesto,
quindi dashboard solo dopo `onboarding_status = completed`. Le etichette di tipo
non sono ruoli e non concedono privilegi. La verifica email è temporaneamente
disabilitata solo per il bootstrap locale e va riattivata prima di staging o
production.

## Database

Le migration operative attuali sono in `apps/backend/supabase`. Il vecchio
schema identity/organization del frontend non va duplicato automaticamente:
prima di produzione va definita una migration di convergenza e verificata la
compatibilità tra account Supabase, profili, organizzazioni e membership.

Per un reset locale intenzionale usare `cd apps/backend && npx supabase db reset`;
il comando elimina e ricrea i dati locali applicando tutte le migration, quindi
non va usato contro un progetto remoto o per conservare account di sviluppo.

## Verifiche minime

Dal root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

La suite backend può richiedere socket locali e Redis disponibili, mentre la
build frontend non richiede servizi esterni.
