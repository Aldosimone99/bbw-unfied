# BBW Frontend

Frontend Next.js derivato da `bbwlanding`, integrato con il backend Express di
`bbw-transition`.

La fonte di verità architetturale è `../../.kiro/steering/`. Prima di modificare
il frontend leggere `../../AGENTS.md`, questo appunto e tutti gli steering file.

## Avvio locale

Dal root:

```bash
cp apps/next/.env.example apps/next/.env.local
npm run dev:frontend
```

Il frontend è disponibile su <http://localhost:3000>. Per il flusso completo
servono anche backend Express su `3001`, Supabase locale e Redis; usare
`npm run dev` dal root per avviare frontend e backend insieme.

Variabili pubbliche necessarie in `apps/next/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chiave-publishable-da-supabase-status>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BBW_BACKEND_URL=http://localhost:3001
```

Il frontend non deve contenere `SUPABASE_SERVICE_ROLE_KEY` o altri secret.

## Flusso auth

`/registrati` e `/register` mostrano la registrazione account-first: email,
password, conferma password e consensi. Il tipo di account viene richiesto
dopo il primo login nella pagina `/onboarding`. Lo stato dei campi resta locale
durante gli errori di validazione; il tipo richiesto viene normalizzato lato
server e non concede automaticamente privilegi.

Il frontend comunica con il backend tramite `/api/backend/*`; non importa
direttamente servizi o repository backend. Le decisioni di accesso alla
dashboard sono server-side e devono restare coerenti con RLS.

## Verifiche

Dal root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Per i dettagli di dominio, sicurezza, UI e integrazione leggere la cartella
`.kiro/steering/` root e in particolare `14-monorepo-integration.md`.
