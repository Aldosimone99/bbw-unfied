# BBW Unified — Current State Handoff

> Documento di passaggio per una nuova chat o per un nuovo collaboratore.
> Descrive lo stato effettivo del repository al 12 agosto 2026.

## 1. Obiettivo del progetto

`bbw-unified` unisce:

- il frontend e il design system di `bbwlanding`;
- il backend operativo e i moduli di `bbw-transition`;
- una nuova fondazione identity/authorization progettata per essere mantenibile e sicura.

La decisione architetturale corrente è:

```text
bbwlanding                         bbw-transition
frontend, landing, UI      +       backend, servizi, moduli
             \                         /
              \                       /
               BBW Unified
          modello canonico nuovo
```

Il modello canonico separa esplicitamente:

```text
Account (Supabase Auth)
  └── Profile
        ├── ProfessionalProfile → ProfessionalType
        ├── Subject
        └── OrganizationMembership → Role → Permission

Organization → OrganizationType
```

La scelta iniziale dell’utente non è un ruolo e non assegna permessi. Un
account può essere contemporaneamente cliente, professionista, membro di più
organizzazioni o titolare di più profili professionali.

## 2. Stato attuale in breve

### Operativo end-to-end

- landing marketing;
- registrazione account-first;
- login;
- sessione Supabase SSR;
- onboarding in due passaggi;
- scelta del contesto personale/professionale/organizzativo/commerciale;
- creazione atomica dell’organizzazione e della membership owner quando viene
  scelto il contesto `organization`;
- risoluzione backend di profilo, membership, ruoli e permessi;
- accesso protetto alla dashboard;
- visualizzazione e modifica del profilo personale;
- struttura di navigazione della piattaforma;
- modello canonico di inviti organizzativi;
- primo modulo backend per i profili professionali e richiesta verifica;
- health check backend;
- test unitari, di route, di schema e di autorizzazione per la fondazione.

### Presente ma non ancora un vertical slice completo

Le route frontend esistono e sono protette dal contesto autorizzativo, ma molte
mostrano ancora una schermata placeholder:

- calendario;
- catalogo e servizi;
- clienti e relazioni;
- consensi e documenti;
- disponibilità;
- inviti lato frontend;
- membri e staff;
- messaggi;
- prenotazioni;
- report;
- storico;
- impostazioni.

Nel backend esistono molti servizi derivati da `bbw-transition`, ma le relative
route non sono abilitate nel runtime canonico. Devono essere portati uno alla
volta sul nuovo schema, con ownership, permessi, RLS, audit e test.

## 3. Funzionalità visibili del sito

### Landing pubblica

La home `/` deriva dalla landing di `bbwlanding` e mantiene il linguaggio
visivo Beauty Broker World:

- hero editoriale;
- branding e watermark;
- accesso alla registrazione;
- accesso al login;
- layout marketing separato dal layout della piattaforma.

Il markup principale è in:

- `apps/next/src/components/layout/landingMarkup.ts`;
- `apps/next/src/components/layout/LandingClient.tsx`;
- `apps/next/src/components/layout/LandingClient.module.css`.

### Registrazione

Route principali:

- `/registrati` — alias pubblico della registrazione;
- `/register` — route equivalente.

Il form chiede soltanto:

- email;
- password;
- conferma password;
- accettazione termini e condizioni;
- accettazione privacy.

Non chiede all’inizio se l’utente è cliente, medico, estetista, clinica o
commerciale. Questa informazione viene raccolta dopo il primo login.

La password richiede almeno:

- 8 caratteri;
- una lettera maiuscola;
- una lettera minuscola;
- un numero;
- un carattere speciale.

In locale la conferma email è disabilitata per consentire il bootstrap senza
provider email. Deve essere riattivata prima di staging e produzione.

Il form usa stato locale per non perdere i valori già inseriti quando una
Server Action restituisce errori di validazione.

### Login

Route principali:

- `/accedi`;
- `/login` — alias compatibile.

Il frontend invia email e password al backend. Il backend autentica tramite il
client Supabase anon/publishable, restituisce access token e refresh token, e il
frontend salva la sessione tramite il client Supabase server-side.

Dopo il login:

- profilo incompleto → `/onboarding`;
- profilo completato → `/dashboard` oppure area compatibile con il contesto;
- utente non autenticato → `/accedi`;
- amministratore platform → area admin quando disponibile e autorizzata.

### Onboarding

Route: `/onboarding`.

Step 1 — profilo personale:

- nome;
- cognome;
- telefono opzionale.

Step 2 — intenzione di utilizzo:

- cliente / percorso personale → `personal`;
- professionista sanitario → `healthcare_professional`;
- professionista beauty → `beauty_professional`;
- clinica / organizzazione → `organization`;
- commerciale → `commercial`.

Per `organization` viene richiesto anche il nome dell’organizzazione. La
scelta è un intent descrittivo: non crea da sola un ruolo professionale e non
concede permessi sensibili.

La finalizzazione viene eseguita dal backend tramite la funzione SQL
`complete_account_onboarding`, accessibile soltanto al service role. Per una
organizzazione, creazione dell’organizzazione, membership e ruolo owner sono
gestiti in una transazione.

### Dashboard e piattaforma

La dashboard usa:

- `PlatformShell` per sidebar, account menu e navigazione;
- `DashboardView` per la home autenticata;
- `ContextSwitcher` per il contesto organizzativo attivo;
- `requirePlatformContext` per caricare e controllare il contesto;
- `DashboardForbidden` per gli accessi non consentiti;
- `PlatformPlaceholder` per i moduli ancora da completare.

Le sezioni esistenti sono:

| Route | Funzione prevista | Stato UI |
| --- | --- | --- |
| `/dashboard` | Home piattaforma | Struttura attiva |
| `/profilo` | Profilo personale | Vista/form presenti |
| `/impostazioni` | Preferenze account | Placeholder |
| `/calendario` | Calendario personale/organizzativo | Placeholder |
| `/catalogo` | Trattamenti e servizi | Placeholder |
| `/clienti` | Clienti e relazioni | Placeholder |
| `/consensi` | Consensi, documenti e firme | Placeholder |
| `/disponibilita` | Orari e disponibilità | Placeholder |
| `/inviti` | Inviti nel network | Placeholder |
| `/membri` | Membri dell’organizzazione | Placeholder |
| `/messaggi` | Comunicazione | Placeholder |
| `/prenotazioni` | Richieste e prenotazioni | Placeholder |
| `/report` | Report commerciali | Placeholder |
| `/staff` | Team della struttura | Placeholder |
| `/storico` | Storico del cliente | Placeholder |

La protezione visuale della pagina non è considerata sufficiente per la
sicurezza: ogni operazione reale dovrà essere verificata anche nel backend e
nel database.

Nota tecnica: la navigazione legacy in `transitionNavigation.ts` usa ancora un
fallback dall’intent richiesto (`personal`, `organization`, ecc.) a una voce
compatibile come cliente o clinica quando manca un `operationalRole`. Questo
serve oggi a mantenere coerente il prototipo visuale, ma non deve essere usato
per autorizzare funzionalità reali. Prima di attivare moduli sensibili la
navigazione dovrà basarsi su ruoli/permission restituiti dal backend e non
sull’intent iniziale.

## 4. Struttura del repository

```text
bbw-unified/
├── apps/
│   ├── next/                         # frontend Next.js
│   │   ├── src/app/                  # route e layout App Router
│   │   ├── src/components/           # layout e componenti condivisi
│   │   ├── src/features/auth/        # login, registrazione, onboarding
│   │   ├── src/features/dashboard/   # shell, dashboard, contesto
│   │   ├── src/features/profile/     # profilo account
│   │   ├── src/features/organizations/# switcher e azioni organizzative
│   │   ├── src/server/               # servizi SSR, auth e proxy
│   │   ├── src/lib/                  # Supabase, validazione, utility
│   │   ├── src/types/                # tipi frontend del contesto
│   │   └── src/proxy.ts              # aggiornamento sessione Supabase
│   │
│   └── backend/                      # backend Express/TypeScript
│       ├── src/routes/               # traduzione HTTP e middleware route
│       ├── src/controllers/          # handler più articolati
│       ├── src/services/             # casi d’uso e regole di dominio
│       ├── src/middleware/           # auth, tenant, ruoli, token sensibili
│       ├── src/db/                   # client Supabase e tipi DB
│       ├── src/__tests__/             # test backend
│       └── supabase/
│           ├── migrations/            # schema canonico attivo
│           ├── migrations-legacy/    # storico non applicato di default
│           ├── seed.sql               # seed sintetico locale
│           └── config.toml            # configurazione Supabase locale
│
├── packages/interfaces/              # schemi Zod e contratti condivisi
├── scripts/dev.mjs                   # avvio frontend + backend
├── .kiro/steering/                   # fonte di verità architetturale
├── docs/                             # roadmap e documentazione di progetto
├── AGENTS.md                         # istruzioni per agenti e collaboratori
└── README.md                         # setup e workflow principale
```

## 5. Frontend: architettura e responsabilità

### App Router

I gruppi di route separano le responsabilità:

- `(marketing)` — landing pubblica;
- `(auth)` — login, registrazione e onboarding;
- `(platform)` — area autenticata e dashboard.

Il layout `(platform)` carica il contesto autorizzato e impedisce di renderare
le pagine senza account/profilo validi. Il layout `(auth)` gestisce la
presentazione delle pagine di accesso senza mescolare la navigazione della
piattaforma.

### Server Actions

Le azioni principali sono in:

- `apps/next/src/features/auth/actions.ts`;
- `apps/next/src/features/profile/actions.ts`;
- `apps/next/src/features/organizations/actions.ts`.

Le Server Actions:

1. ricevono `FormData`;
2. validano con Zod;
3. chiamano un service server-side;
4. restituiscono errori applicativi senza esporre dettagli infrastrutturali;
5. usano `redirect` soltanto dopo una mutazione riuscita.

### Auth e contesto

I file centrali sono:

- `src/server/services/auth-service.ts` — registrazione, login, logout,
  onboarding;
- `src/server/auth/transition-session.ts` — sessione Supabase e chiamate al
  contesto backend;
- `src/server/auth/current-user.ts` — user/profile derivati dal contesto
  canonico;
- `src/server/services/post-login-service.ts` — destinazione dopo login;
- `src/server/authorization/context.ts` — contesto lato frontend;
- `src/server/authorization/permissions.ts` — controllo permission;
- `src/server/authorization/dashboard-access.ts` — accesso alla dashboard.

La fonte canonica per il frontend è `GET /auth/context`. Non usare il vecchio
shape di `/auth/me` come prova di autorizzazione: il profilo canonico non usa
`tipo_utente` per decidere l’accesso.

### Confine frontend/backend

Il browser usa la route bridge:

```text
browser → Next /api/backend/[...path]
        → sessione Supabase server-side
        → Bearer token verificato
        → backend Express
```

Le Server Actions auth/onboarding possono chiamare direttamente
`BBW_BACKEND_URL` perché girano soltanto sul server. Il service-role key non
deve mai arrivare nel bundle browser.

## 6. Backend: architettura e responsabilità

### Runtime Express

`apps/backend/src/index.ts` configura:

- CORS tramite allowlist;
- `credentials: true`;
- metodi e header consentiti;
- limite JSON configurabile, default `1mb`;
- disabilitazione di `x-powered-by`;
- middleware di contesto organizzativo;
- route canoniche sempre abilitate;
- route transition dietro feature flag.

Porta predefinita: `3001`.

### Route canoniche attive

#### Auth e onboarding

- `POST /auth/register`;
- `POST /auth/login`;
- `GET /auth/me` — profilo applicativo verificato, non fonte di permessi;
- `GET /auth/context` — user, profile, memberships, organizzazione attiva e
  permission;
- `POST /auth/onboarding/profile`;
- `POST /auth/onboarding/complete`.

#### Inviti organizzativi

Base: `/company/invites`.

- `GET /company/invites/lookup/:token`;
- `POST /company/invites/accept`;
- `POST /company/invites`;
- `GET /company/invites`;
- `DELETE /company/invites/:id`;
- `POST /company/invites/:id/resend`.

Le operazioni di gestione richiedono un ruolo organizzativo compatibile:
`organization_owner`, `organization_admin` o `office_manager`. Il token di
invito viene persistito soltanto come hash.

#### Profili professionali

Base: `/professional-profile`.

- `GET /professional-profile/types`;
- `GET /professional-profile/me`;
- `POST /professional-profile/me`;
- `PATCH /professional-profile/me/:profileId`;
- `POST /professional-profile/me/:profileId/request-verification`.

I tipi professionali sono catalogati in `professional_types` e il profilo ha
uno stato di verifica separato.

#### Health

- `GET /health` → `{ status: "ok" }`.

### Route transition disabilitate

Con `ENABLE_LEGACY_TRANSITION_ROUTES=false`, il runtime non monta le route per:

- inviti/referral legacy;
- contratti commerciali;
- contratti professionali;
- documenti professionali;
- onboarding legacy;
- admin legacy;
- notifiche;
- messaggi/chat;
- PPL;
- prenotazioni;
- disponibilità e slot;
- catalogo;
- template consensi e documenti consensi;
- users legacy;
- address provider.

I file esistono per il porting progressivo e per i test di riferimento, ma la
presenza del codice non equivale a una funzionalità pronta per dati reali.
Non abilitare il flag in staging o produzione senza migrazione schema,
autorizzazione e test completi.

### Strati backend

- `routes/`: parsing HTTP, status code, validazione input e composizione
  middleware;
- `controllers/`: coordinamento degli handler più complessi;
- `services/`: regole di dominio e casi d’uso;
- `middleware/resolve-user-middleware.ts`: risolve l’account dal Bearer token
  verificato;
- `middleware/resolve-company-context-middleware.ts`: prepara il contesto
  organizzativo, senza trasformare un header in prova di ownership;
- `middleware/require-role-middleware.ts`: autorizzazione per permission/ruolo;
- `middleware/require-company-role-middleware.ts`: autorizzazione
  organizzativa;
- `middleware/require-sensitive-token.ts`: protezione aggiuntiva per operazioni
  sensibili;
- `db/supabase.ts`: client server-role e client anon separati;
- `services/authorization-context-service.ts`: calcolo del contesto unico.

## 7. Servizi backend già presenti

I servizi derivati da `bbw-transition` sono organizzati per dominio. Quelli
attualmente più importanti per la fondazione sono:

- `registration-service.ts`;
- `login-service.ts`;
- `account-onboarding-service.ts`;
- `authorization-context-service.ts`;
- `profile-service.ts`;
- `professional-profile-service.ts`;
- `company-invite-service.ts`;
- `rate-limit-service.ts`;
- `sensitive-token-service.ts`.

Sono inoltre presenti servizi ancora da portare sul modello canonico:

- catalogo piattaforma, azienda e custom services;
- ruoli catalogo e pricing;
- disponibilità e slot;
- bookings;
- messaging e chat;
- notifiche e email;
- consensi, template, documenti e firme;
- contratti professionali e commerciali;
- referral e PPL;
- admin;
- address provider;
- company/user legacy.

Per ogni porting occorre verificare prima soggetto, tenant, ownership, dati
sensibili, stati, permessi, RLS, audit e idempotenza.

## 8. Modello dati canonico

Migration attive:

```text
apps/backend/supabase/migrations/
├── 20260812000000_foundation_identity_authorization.sql
├── 20260812000100_account_onboarding_rpc.sql
├── 20260812000200_account_consents.sql
├── 20260812000300_rls_policy_hardening.sql
├── 20260812000400_canonical_invitations.sql
└── 20260812000500_accept_invitation_transaction.sql
```

Tabelle principali:

| Tabella | Responsabilità |
| --- | --- |
| `auth.users` | Identità tecnica Supabase |
| `profiles` | Dati personali e stato onboarding |
| `organization_types` | Catalogo delle organizzazioni |
| `organizations` | Cliniche, studi, aziende, reti e altri contesti |
| `organization_members` | Membership account-organizzazione |
| `roles` | Ruoli platform o organizzativi |
| `permissions` | Capacità semantiche |
| `role_permissions` | Mapping ruolo-permission |
| `member_roles` | Ruoli assegnati nella singola organizzazione |
| `account_roles` | Ruoli platform assegnati all’account |
| `professional_types` | Catalogo medico, sanitario, beauty, accountant, commerciale |
| `professional_profiles` | Profilo professionale e verifica |
| `subjects` | Persona o organizzazione di un percorso |
| `invitations` | Inviti organizzativi hashati e revocabili |
| `account_consents` | Consensi legali e comunicazione versionati |
| `audit_events` | Traccia delle operazioni sensibili |

### Ruoli e permessi seed

Ruoli principali:

- `platform_admin`;
- `account_holder`;
- `organization_owner`;
- `organization_admin`;
- `clinical_director`;
- `practitioner`;
- `office_manager`;
- `finance`;
- `staff`;
- `customer`.

Permission principali:

- `dashboard.access`;
- `platform.admin.access`;
- `profile.read_own`;
- `profile.update_own`;
- `organization.create`;
- `organization.read`;
- `organization.update`;
- `organization.members.read`;
- `organization.members.invite`;
- `organization.members.manage`;
- `professional_profile.create`;
- `professional_profile.read_own`;
- `professional_profile.update_own`;
- `professional_profile.verify`;
- `audit.read`.

Tipi professionali seed:

- `physician`;
- `healthcare_professional`;
- `beauty_professional`;
- `accountant`;
- `commercial_agent`;
- `other`.

Tipi organizzazione seed:

- `clinic`;
- `beauty_studio`;
- `accounting_firm`;
- `company`;
- `network`;
- `other`.

## 9. Sicurezza e autorizzazioni

Regole fondamentali:

- il backend è l’autorità per regole operative e autorizzazione;
- ogni route protetta risolve l’utente dal Bearer token verificato;
- `userId`, ruolo, actor e tenant non vengono considerati attendibili se
  arrivano soltanto dal client;
- l’header organizzativo può aiutare a selezionare un contesto, ma non prova
  membership o ownership;
- il frontend può nascondere azioni, ma non protegge i dati;
- le policy PostgreSQL/RLS sono una seconda barriera;
- il service role è confinato al backend;
- login credenziali usa un client anon/publishable separato;
- i token di invito sono hashati;
- le transazioni privilegiate sono esposte tramite funzioni SQL service-role;
- i dati sanitari, documenti e firme dovranno avere policy e audit dedicati;
- le categorie visuali cliente/clinica/medico non sono evidenza di permesso.

Il modello corretto per i diversi attori è:

| Attore | Modello |
| --- | --- |
| Cliente | `Profile` + `Subject` persona |
| Medico/dottore | `ProfessionalProfile` con tipo sanitario, verifica separata |
| Estetista | `ProfessionalProfile` con tipo beauty |
| Commercialista | `ProfessionalProfile` accountant + eventuale membership studio |
| Clinica | `Organization` con `organization_type=clinic` |
| Commerciale | Profilo professionale/membership secondo il contesto assegnato |
| Proprietario struttura | Membership + `organization_owner` |

## 10. Contratti condivisi

`packages/interfaces` contiene gli schemi Zod e i tipi usati per evitare
contratti HTTP divergenti tra frontend e backend. Comprende schemi per:

- auth e registrazione;
- login;
- onboarding;
- profilo;
- organizzazioni e inviti;
- ruoli e utenti;
- catalogo;
- disponibilità;
- prenotazioni;
- messaggi/chat;
- notifiche;
- consensi;
- documenti e contratti;
- address;
- referral/PPL.

Quando si porta un modulo, aggiungere o aggiornare prima il contratto condiviso,
poi route/service backend e infine UI.

## 11. Avvio locale

Dalla root:

```bash
npm install
cp apps/next/.env.example apps/next/.env.local
cp apps/backend/.env.example apps/backend/.env.local
```

Avviare Supabase dalla directory backend, non dalla root:

```bash
cd apps/backend
npx supabase start
npx supabase status
```

Variabili frontend minime:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BBW_BACKEND_URL=http://localhost:3001
```

Variabili backend minime:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local-anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
REDIS_URL=redis://localhost:6379
CORS_ALLOWED_ORIGINS=http://localhost:3000
JSON_BODY_LIMIT=1mb
ENABLE_LEGACY_TRANSITION_ROUTES=false
```

Redis locale:

```bash
docker run --name bbw-redis -p 6379:6379 -d redis:7-alpine
```

Se il container esiste già:

```bash
docker start bbw-redis
```

Avvio completo:

```bash
npm run dev
```

Porte previste:

- frontend: `http://localhost:3000`;
- backend: `http://localhost:3001`;
- Supabase API: `http://127.0.0.1:54321`.

Avvio separato:

```bash
npm run dev:frontend
npm run dev:backend
```

Evitare due processi contemporaneamente: causano `EADDRINUSE` su `3000` o
`3001`.

Reset locale intenzionale:

```bash
cd apps/backend
npx supabase db reset --local
```

Il reset cancella gli utenti e i dati locali. Non usarlo sul progetto remoto.

## 12. Verifica e test

Comandi dalla root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

La suite canonica copre la fondazione identity/authorization, tra cui:

- registrazione;
- login;
- onboarding;
- risoluzione del contesto;
- inviti;
- profili professionali;
- RLS e grant;
- CORS e superficie HTTP;
- contratti condivisi.

I test legacy sono ancora disponibili per il porting:

```bash
npm run test:legacy --workspace @bbw/backend
```

Non sono un’indicazione che le route legacy siano pronte o abilitate.

## 13. Problemi già risolti da ricordare

### Registrazione apparentemente fallita

Il backend creava correttamente l’account e la sessione, ma il frontend
interrogava `/auth/me` aspettandosi il vecchio campo `tipo_utente`. Il profilo
canonico non deve usare quel campo come prova di autorizzazione.

La correzione è stata fatta in:

- `apps/next/src/server/auth/current-user.ts`;
- `apps/next/src/server/auth/transition-session.ts`.

Ora user e profile vengono letti da `/auth/context`, che è il contratto unico
per identity applicativa, membership e permessi.

### Perdita dei campi in caso di errore

I form account-first e onboarding mantengono i valori nello stato del client e
non devono essere riscritti con valori vuoti quando una Server Action restituisce
errori di validazione.

### Email già registrata

Il frontend mappa anche il codice backend `EMAIL_ALREADY_EXISTS` in un errore
comprensibile senza esporre dettagli interni.

### Stato locale del database

Gli account sintetici creati durante i test browser sono stati rimossi. Il
database locale resta comunque ricreabile tramite `supabase db reset --local`;
il database remoto non è stato usato né modificato durante questa verifica.

## 14. Cosa fare dopo

Ordine consigliato dei prossimi vertical slice:

1. profilo personale completo;
2. organizzazioni, inviti e gestione membership;
3. ruoli organizzativi e cambio contesto;
4. profili professionali e verifica amministrativa;
5. catalogo e servizi;
6. disponibilità, slot e prenotazioni;
7. consensi, documenti e firme;
8. messaggi e notifiche;
9. contratti e funzioni commerciali;
10. admin e reportistica.

Per ogni modulo completare questa sequenza:

```text
modello dati
  → migration e vincoli
  → RLS/grant
  → contratto Zod condiviso
  → repository/service backend
  → route protetta
  → test unitari/route/SQL
  → UI responsive
  → audit/idempotenza
  → smoke test end-to-end
```

Non riattivare in blocco le route transition. Portare un modulo soltanto dopo
aver mappato ogni record a account, profile, subject, organization, membership,
ruolo e permission.

## 15. Istruzioni per la prossima chat

Prima di modificare il progetto:

1. leggere questo documento;
2. leggere `AGENTS.md`;
3. leggere tutti i file `.kiro/steering/00-product.md` fino a
   `.kiro/steering/14-monorepo-integration.md`;
4. leggere il README della specifica app coinvolta;
5. controllare lo stato Git e le migration già applicate;
6. distinguere sempre tra codice presente, route attiva e funzionalità
   end-to-end verificata.

Vincoli da non violare:

- non reintrodurre il vecchio modello `users`/`companies` come fonte primaria;
- non aggiungere tipo account nella registrazione iniziale;
- non usare `tipo_utente` o etichette UI per autorizzare operazioni;
- non esporre service-role key;
- non abilitare `ENABLE_LEGACY_TRANSITION_ROUTES` in ambienti condivisi;
- non modificare o resettare database remoti senza una richiesta esplicita e
  una verifica dei dati da conservare;
- mantenere allineati codice, migration, test, README, AGENTS e steering.

Documentazione di riferimento:

- `README.md`;
- `AGENTS.md`;
- `docs/foundation-roadmap.md`;
- `docs/canonical-domain-model.md`;
- `docs/transition-module-inventory.md`;
- `.kiro/steering/01-architecture.md`;
- `.kiro/steering/02-domain-model.md`;
- `.kiro/steering/03-database.md`;
- `.kiro/steering/04-auth-and-permissions.md`;
- `.kiro/steering/05-security.md`;
- `.kiro/steering/14-monorepo-integration.md`.


## Domain alignment status — 14 agosto 2026

Il repository ha una fondazione canonica per identity, organization, RBAC, OperationalContext, Patient globale, relationship scoped, patient invitation separata e catalogo con offering scoped. Il CSV importato deve essere interpretato come **BBW Treatment Library / Template Library**, non come catalogo centrale obbligatorio.

Le route e migration legacy per booking, availability, rooms, consensi e documenti avanzati restano archiviate/disabilitate. Non rappresentano funzionalità canoniche pronte per dati reali.

**APPROVED**: Patient globale, ProfessionalProfile globale, multi-organization, TreatmentDefinition/Offering, template/custom definition, soft removal e audit.

**TBD / BLOCKED**: retention, qualification taxonomy, sharing storico globale, booking completo, agenda, availability canonica, consensi avanzati, pagamenti, documenti avanzati e payout.

Vedere `docs/domain/decision-register.md`.
