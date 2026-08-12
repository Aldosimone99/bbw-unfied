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
essere la service-role/secret key del progetto locale corretto. Il backend usa
separatamente `SUPABASE_ANON_KEY` soltanto per il login utente; la service-role
non deve stabilire sessioni utente.

`npm run dev` avvia entrambi i processi sulle porte `3000` (frontend) e `3001`
(backend). Va eseguita una sola istanza root alla volta: se una porta è già
occupata, fermare il vecchio processo con `lsof`/`kill` prima di riavviare.
Per debug isolato usare `npm run dev:frontend` o `npm run dev:backend`.

## Confine frontend/backend

Le chiamate browser-facing raggiungono l'API attraverso `/api/backend/[...path]`.
Il proxy legge la sessione Supabase server-side e inoltra un Bearer token al
backend; le Server Actions di auth/onboarding chiamano direttamente il backend
configurato ma restano server-only. Il browser non deve conservare la
service-role key né un token backend persistente.

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

La baseline attiva usa il modello di `bbwlanding` con profili, organizzazioni,
membership, ruoli, permessi, profili professionali, soggetti, inviti e audit.
Le migration legacy sono archiviate in `apps/backend/supabase/migrations-legacy`
e non vengono applicate a un database nuovo. I moduli transition non ancora
portati devono restare fuori dai flussi operativi finché schema, permission,
ownership e test non sono stati adattati.

La variabile `ENABLE_LEGACY_TRANSITION_ROUTES` è `false` per default. Serve
solo per ispezionare i moduli storici in un ambiente isolato e non autorizza
il loro uso con dati reali.

Qualsiasi migrazione futura di dati reali richiederà una procedura separata,
backup e approvazione.

Per un reset locale intenzionale usare `cd apps/backend && npx supabase db reset --local`;
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

`npm test` esegue la suite canonica. `npm run test:legacy --workspace
@bbw/backend` conserva visibilità sui test transition archiviati, che possono
restare rossi finché il relativo modulo non viene portato. La build frontend
non richiede servizi esterni.
