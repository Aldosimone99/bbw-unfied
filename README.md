# BBW Unified

Monorepo di Beauty Broker World: frontend derivato da `bbwlanding`, backend
operativo derivato da `bbw-transition` e contratti condivisi.

## Struttura

- `apps/next`: landing, autenticazione, onboarding e dashboard Next.js.
- `apps/backend`: API Express/TypeScript, servizi di dominio e schema Supabase
  operativo.
- `packages/interfaces`: schemi Zod e contratti condivisi tra frontend e
  backend.
- `.kiro/steering`: unica fonte di verità per prodotto, architettura, dominio,
  sicurezza e workflow AI.

Il modello distingue `Account`, `Profile`, `Organization`, `OrganizationMembership`,
`Role`, `Permission` e `Subject`. “Utente”, “cliente” o “clinica” sono etichette
di prodotto e non devono essere usate come prova di autorizzazione.

## Avvio locale

Prerequisiti: Node.js, Docker, Supabase CLI e Redis.

Dal root:

```bash
npm install
cp apps/next/.env.example apps/next/.env.local
cp apps/backend/.env.example apps/backend/.env.local
```

Avvia Supabase locale dal backend:

```bash
cd apps/backend
npx supabase start
npx supabase status
```

Usa l'URL locale e la chiave publishable mostrati da `supabase status` in:
`apps/next/.env.local` (`NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Usa la service-role key mostrata dallo
stesso comando solo in `apps/backend/.env.local` come
`SUPABASE_SERVICE_ROLE_KEY`. Non copiare chiavi reali nel repository o nel
frontend.

Avvia Redis, se non è già attivo:

```bash
docker run --name bbw-redis -p 6379:6379 -d redis:7-alpine
```

Poi, dal root, avvia i due processi:

```bash
npm run dev
```

URL locali:

- frontend: <http://localhost:3000>
- backend: <http://localhost:3001>

Per avviarli separatamente: `npm run dev:frontend` e
`npm run dev:backend`.

Se Redis esiste già, non rilanciare il comando Docker: usare il container
esistente o `docker start bbw-redis`.

## Flusso account-first

La registrazione iniziale segue il comportamento di `bbwlanding`: email,
password, conferma password e consensi. Non viene richiesto il tipo di account
durante la registrazione. Dopo il primo login, l'account incompleto passa
all'onboarding per profilo e tipo richiesto; il tipo richiesto non assegna da
solo un ruolo privilegiato.

In locale la conferma email è temporaneamente disabilitata per il bootstrap. Va
riattivata e testata prima di staging o produzione. La password richiede almeno
8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale.

## Confine frontend/backend

Il frontend raggiunge il backend tramite `/api/backend/*`. Il bridge Next legge
la sessione Supabase server-side e inoltra il Bearer token al backend Express.
Il browser non riceve la service-role key e non decide ruoli, permission,
ownership o tenant.

Le migration operative sono in `apps/backend/supabase/migrations`. Il vecchio
schema identity del frontend non viene mantenuto come seconda fonte di verità.
I reset locali sono distruttivi per i dati locali:

```bash
cd apps/backend
npx supabase db reset
```

## Verifiche

Dal root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Documentazione e contributi

Prima di modificare codice, leggere il `AGENTS.md` root e tutti i file da
`.kiro/steering/00-product.md` a `.kiro/steering/14-monorepo-integration.md`.
Gli `AGENTS.md` dentro le app aggiungono vincoli locali e rimandano sempre allo
steering root; non creare una seconda cartella di steering.

- architettura e dipendenze: `.kiro/steering/01-architecture.md`;
- dominio e terminologia: `.kiro/steering/02-domain-model.md`;
- database e migration: `.kiro/steering/03-database.md`;
- autenticazione e autorizzazione: `.kiro/steering/04-auth-and-permissions.md`;
- integrazione monorepo: `.kiro/steering/14-monorepo-integration.md`.
