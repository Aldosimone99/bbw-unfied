# 01 — Architettura

## Stato osservato

Il repository usa Next.js App Router con `src/app`, React, TypeScript `strict`, CSS globale/CSS Modules e Tailwind configurato ma non dominante. Il lockfile risolve Next 16.2.9, React 19.2.7, TypeScript 6.0.3, Zod 4.4.3 e Vitest 4.1.10; `package.json` usa ancora `latest` per alcune dipendenze e va reso riproducibile prima di una release. Sono presenti factory Supabase browser/server, Server Actions auth e organizations, membership/authorization services, Context Switcher e `src/proxy.ts` come boundary di refresh della sessione. `src/proxy.ts` è il proxy Next attivo: non va chiamato middleware nei documenti o nel codice senza verificare la convenzione della versione Next in uso.

## Architettura proposta

Il sistema è un monorepo con frontend Next.js, backend Express/TypeScript derivato da `bbw-transition` e contratti condivisi. PostgreSQL è la fonte dei dati applicativi; Supabase fornisce Auth, database, Storage e strumenti locali. L'API Express è l'autorità per le operazioni del backend di transizione; PostgREST/SDK sono dettagli di accesso e non sostituiscono i servizi che applicano regole di dominio.

Direzione delle dipendenze:

`UI/Page → server action o route handler → service di caso d’uso → repository/data access → Supabase/PostgreSQL/Storage`.

Le dipendenze devono fluire verso contratti e dominio. Repository e adapter non devono essere importati direttamente da componenti UI. Un service può coordinare più repository, validare invarianti e aprire una transazione dove necessario. Il frontend comunica con l'Express backend tramite il bridge Next `/api/backend/*`, senza importare direttamente il codice del backend.

Composizione attuale:

```text
apps/next → /api/backend/* → apps/backend → Supabase/PostgreSQL/Redis
      └──────── packages/interfaces (contratti Zod e tipi condivisi)
```

## Responsabilità dei livelli

- **Next.js/App Router**: routing, rendering, metadata, boundary server/client, gestione delle richieste e redirect. Le route auth e platform esistono; la dashboard applica già una prima guardia server-side.
- **Server Components**: lettura autorizzata, composizione delle pagine e rendering iniziale. Non ricevono segreti dal client e non contengono mutazioni di dominio.
- **Client Components**: interazione locale, stato transitorio, form UX e progressive enhancement. Non decidono l’autorizzazione.
- **Server Actions**: mutazioni originate da UI interna, tipizzate e con input Zod; nel repository sono usate per login, registrazione, onboarding e cambio dell’organizzazione attiva. Devono ricostruire sessione, contesto e permessi sul server.
- **Route Handlers**: webhook, endpoint usati da client/partner, download controllati, callback e casi che richiedono status code/headers espliciti. Attualmente è implementato il callback Auth; le API di dominio non sono ancora presenti.
- **Service layer**: casi d’uso e invarianti applicative; non conosce dettagli di presentazione.
- **Repository/data access**: query parametrizzate, mapping righe/DTO, filtri di tenant e chiamate a Supabase/PostgreSQL. Non decide da solo policy complesse.
- **Supabase Auth**: identità, sessione e lifecycle credenziali. I dati applicativi dell'account restano nel dominio BBW e il backend verifica il Bearer token prima delle route protette.
- **PostgreSQL/RLS**: vincoli, relazioni, transazioni e ultima barriera di isolamento; RLS deve essere coerente con l’autorizzazione server.
- **Storage**: allegati in bucket privati, metadata nel database, URL firmati solo dopo controllo accessi.
- **Integrazioni esterne**: adapter isolati, timeout, retry limitati, idempotency key e segreti solo server-side.

## Server Action o Route Handler

Usare una **Server Action** quando la mutazione nasce da una pagina BBW e non deve essere un’API pubblica: ad esempio aggiornare un profilo o accettare un invito. Usare un **Route Handler** quando servono un contratto HTTP esplicito, consumo da codice esterno, webhook, callback OAuth, upload/download controllato o status code diversi. In entrambi i casi il service resta condiviso e non si duplicano le regole.

## Errori

I servizi distinguono errore di input, non autenticato, non autorizzato, risorsa assente, conflitto di stato e errore infrastrutturale. La UI riceve messaggi utili ma non dettagli interni; gli endpoint restituiscono una forma d’errore stabile con `code`, messaggio utente e correlation id quando disponibile. Non trasformare un errore di permesso in “risorsa vuota” se questo nasconde una violazione o rende il flusso ambiguo.

## Struttura compatibile con il repository

```text
src/app/
  (marketing)/
  (auth)/
  (platform)/
  auth/callback/
src/proxy.ts                 # refresh sessione Supabase per le richieste
src/components/              # UI riusabile, senza accesso dati
src/features/<feature>/      # UI e contratti specifici della feature
src/lib/
  supabase/                  # client già presenti; normalizzare le env
  validation/ errors/ utils/
src/server/
  auth/ authorization/ security/ audit/
  services/ repositories/
src/types/                   # DTO e tipi pubblici condivisi
apps/backend/supabase/
  migrations/ seed.sql tests/ # schema operativo, dati locali e regressioni RLS
packages/interfaces/
  src/schemas/                # contratti condivisi frontend/backend
```

Le cartelle `.gitkeep` ancora presenti sono scaffolding, non prova di implementazione. Oggi `features/auth`, `features/dashboard`, `features/profile` e `features/organizations` contengono codice; le directory future non vanno trattate come feature disponibili. Le directory di feature possono contenere componenti e schema di input, ma i casi d’uso sensibili devono restare sotto `src/server`.

## Ambienti

- **Local**: Next dev e Supabase CLI locale; dati sintetici e seed innocui.
- **Development**: progetto Supabase separato, dati non produttivi, logging utile ma redatto.
- **Staging**: configurazione il più possibile simile a production, dati sintetici o anonimizzati, smoke/E2E.
- **Production**: segreti da secret manager, migrazioni approvate, backup/restore verificati, accesso operativo tracciato.

La configurazione locale attuale abilita Auth, Storage, Realtime e il seed `apps/backend/supabase/seed.sql`; le migration operative sono nel backend. Il frontend usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY` è server-only nel processo Next, mentre `SUPABASE_SERVICE_ROLE_KEY` è server-only nel processo Express: nessuna delle due deve mai arrivare al browser o essere committata.

## Cosa non va nei componenti UI

Niente query SQL, chiamate dirette con service role, lettura di cookie nei Client Components per prendere decisioni di sicurezza, regole `if (role === ...)`, calcolo di permessi, gestione di transazioni, firma/cifratura, logica di retention, webhook o accesso a file tramite ID non verificato. Il server può usare il cookie HttpOnly dell’organizzazione attiva solo come indizio e deve sempre verificare membership e stato. I componenti possono mostrare lo stato ricevuto dal server e raccogliere input, non attestare che l’utente abbia diritto a un’azione.
