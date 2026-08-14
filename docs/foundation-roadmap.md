# BBW Unified — Foundation Roadmap

## Decisione architetturale

Il progetto parte con una nuova base applicativa e dati, perché è ancora nelle
prime fasi e non deve trascinarsi dietro il modello identity/organization
legacy di `bbw-transition`.

La direzione è:

```text
Modello dati e autorizzazione di bbwlanding
                    +
Backend Express di bbw-unified
                    +
Moduli funzionali selezionati da bbw-transition
```

Il backend Express è l'autorità per autenticazione applicativa, onboarding,
autorizzazione e regole di dominio. Next.js gestisce UI, rendering e input. Il
database applicativo usa il modello Account/Profile/Organization/Membership/
Role/Permission/Subject e PostgreSQL/RLS resta l'ultima barriera di isolamento.

Questa roadmap non autorizza reset o modifiche a database remoti. Prima di
qualsiasi operazione distruttiva va verificato se esistono utenti o dati reali
da preservare.

## Stato

- [x] Audit iniziale di `bbwlanding`, `bbw-transition` e `bbw-unified`.
- [x] Scelta di `bbw-unified` come repository principale.
- [x] Scelta del modello `bbwlanding` come fondazione identity/authorization.
- [x] Baseline database nuova e riproducibile.
- [ ] Backend Express completamente autorevole per tutti i domini.
- [x] Primo vertical slice identity/onboarding operativo end-to-end.
- [x] Organizzazioni/inviti portati su `organizations`, `organization_members` e `invitations`.
- [x] Primo flusso `professional_profiles` con richiesta di verifica.

## Fase 0 — Protezione e inventario

### Task 0.1 — Proteggere lo stato attuale

- [ ] Verificare branch, modifiche locali e migrazioni già applicate.
- [ ] Verificare che nessun file `.env*`, dump o dato reale sia tracciato.
- [ ] Verificare se esistono dati di sviluppo o produzione da conservare.
- [ ] Creare un backup solo se necessario e conservarlo fuori dal repository.
- [ ] Non usare `db reset` remoto e non riscrivere migration già applicate.

### Task 0.2 — Inventariare il backend di transizione

- [ ] Classificare ogni servizio e route di `bbw-transition` come core, MVP,
  post-MVP o legacy.
- [ ] Mappare per ogni modulo ownership, organizzazione, soggetto e dati
  sensibili coinvolti.
- [ ] Elencare le dipendenze Redis, Storage, posta e provider esterni.
- [ ] Identificare route senza autenticazione o senza controllo tenant.

**Gate:** nessun modulo viene portato nel nuovo schema senza ownership,
autorizzazione e livello di sensibilità documentati.

## Fase 1 — Modello canonico

### Task 1.1 — Definire identità e profilo

- [ ] `auth.users` come identità tecnica Supabase.
- [ ] `profiles` come dati personali applicativi.
- [ ] Stato onboarding separato dal ruolo.
- [ ] Tipo di esperienza iniziale memorizzato come intent, non come privilegio.
- [ ] Dati opzionali e dati obbligatori definiti per step.

### Task 1.2 — Definire organizzazioni e membership

- [ ] `organizations` come confine di proprietà e collaborazione.
- [ ] `organization_types` come catalogo descrittivo.
- [ ] `organization_members` con stato, date e revoca.
- [ ] Più membership per lo stesso account.
- [ ] Context switcher basato solo su membership attiva e verificata.

### Task 1.3 — Definire ruoli e permessi

- [ ] `roles` come assegnazioni contestuali.
- [ ] `permissions` come capacità semantiche stabili.
- [ ] `role_permissions` per il mapping ruolo-permesso.
- [ ] `member_roles` per i ruoli organizzativi.
- [ ] Ruoli globali/platform separati da ruoli organizzativi.
- [ ] Nessuna autorizzazione basata su etichette come cliente o clinica.

### Task 1.4 — Definire soggetti e domini sensibili

- [ ] Distinguere account, profilo e soggetto di un percorso.
- [ ] Definire `professional_profiles` e relativo stato di verifica.
- [ ] Definire relazioni tra soggetti, professionisti e organizzazioni.
- [ ] Definire ownership e visibilità di documenti, consensi e appuntamenti.
- [ ] Marcare i dati sanitari o potenzialmente sanitari prima di implementarli.

**Gate:** il modello non contiene colonne che mescolano account type, ruolo,
membership e stato operativo.

## Fase 2 — Nuova baseline Supabase

### Task 2.1 — Creare migration baseline

- [ ] Creare migration iniziale per identity, profili, organizzazioni,
  membership, ruoli e permessi.
- [ ] Usare vincoli PostgreSQL, foreign key, unique constraint e check.
- [ ] Definire timestamp, soft-delete/revoca e stati ammessi.
- [ ] Definire funzioni transazionali per onboarding e membership.
- [ ] Non copiare le tabelle legacy solo per compatibilità.

**Stato:** completato per la fondazione identity/authorization. Migration attive:
`20260812000000`, `20260812000100`, `20260812000200`, `20260812000300`,
`20260812000400`, `20260812000500`.

### Task 2.2 — Implementare RLS e grant

- [ ] Proteggere profili e membership secondo il soggetto autenticato.
- [ ] Isolare ogni risorsa organizzativa per membership attiva.
- [ ] Impedire a `anon` e `authenticated` di eseguire funzioni privilegiate.
- [ ] Limitare il service role al backend server-side.
- [ ] Aggiungere regressioni SQL per accesso consentito e negato.

### Task 2.3 — Seed e ambiente locale

- [ ] Creare seed sintetici e ripetibili.
- [ ] Non usare `prod-db/data.sql` o dati personali reali.
- [ ] Verificare reset locale completo e applicazione ordinata delle migration.
- [ ] Documentare chiavi, porte e progetti Supabase senza includere segreti.

**Gate:** database vuoto, migration e seed ricreano lo stesso ambiente in modo
ripetibile; i test RLS dimostrano l'isolamento tra due organizzazioni.

**Stato:** reset locale verificato; seed verificato con 6 organization types,
6 professional types, 10 ruoli, 15 permission e mapping ruolo-permission.

## Fase 3 — Backend foundation

### Task 3.1 — Confini applicativi

- [ ] Separare route HTTP, service di caso d'uso, repository e adapter.
- [ ] Definire DTO Zod in `packages/interfaces`.
- [ ] Uniformare errori con codice stabile e correlation id.
- [ ] Aggiungere logging redatto e request id.
- [ ] Evitare query e regole di dominio nei componenti Next.

### Task 3.2 — Auth e contesto

- [ ] Verificare Bearer token su ogni route protetta.
- [ ] Risolvere l'account applicativo dal token verificato.
- [ ] Calcolare profilo, membership, ruoli e permessi nel backend.
- [ ] Derivare il tenant dal database, mai dal solo header del client.
- [ ] Rendere `/auth/context` il contratto unico per il frontend.

### Task 3.3 — Sicurezza trasversale

- [x] Configurare CORS con allowlist per ambiente.
- [x] Definire un limite JSON globale; gli upload avranno endpoint e limiti separati.
- [ ] Applicare rate limit a registrazione, login, password e inviti.
- [ ] Aggiungere idempotency dove un retry può duplicare dati.
- [ ] Proteggere Storage con bucket privati e URL firmati dopo autorizzazione.
- [ ] Aggiungere audit event alle operazioni sensibili.

**Stato:** le route transition non portate sono disabilitate per default;
`ENABLE_LEGACY_TRANSITION_ROUTES=true` è ammesso solo in un ambiente isolato.
Il login usa il client anon, mentre la service-role resta confinata al backend.

**Gate:** nessuna route di dominio può eseguire una mutazione senza identità,
ownership/membership e permission verificati.

## Fase 4 — Account-first e onboarding

- [ ] Mantenere la registrazione minima: email, password, conferma e consensi.
- [ ] Mantenere la policy password di almeno 8 caratteri con complessità.
- [ ] Mantenere la verifica email disabilitata solo in locale.
- [ ] Reintrodurre la verifica email prima di staging e produzione.
- [ ] Salvare profilo e onboarding in step che non perdono gli input validi.
- [ ] Salvare la scelta Cliente/Professionista/Clinica come intent descrittivo.
- [ ] Creare organizzazione e owner membership in una transazione.
- [ ] Non concedere ruoli professionali o clinici sulla base della scelta UI.

**Gate:** registrazione → login → onboarding → dashboard funziona per account
personale e organizzazione, con test browser e test backend.

**Stato:** verificato localmente per account personale e organizzazione; il
database è stato ripulito dopo il test.

## Fase 5 — Primo vertical slice prodotto

Portare una funzionalità completa dall'interfaccia al database prima di
trasferire altri moduli.

### Ordine consigliato

1. profilo personale — base pronta;
2. organizzazione e inviti — primo porting pronto;
3. membership e ruoli — contesto autorizzativo pronto, gestione completa da testare;
4. profilo professionale e verifica — creazione e richiesta pronte, verifica amministrativa da portare;
5. servizi/catalogo;
6. disponibilità e appuntamenti;
7. consensi, documenti e firme;
8. messaggi e notifiche;
9. contratti e funzioni commerciali;
10. amministrazione e reportistica.

Per ogni modulo:

- [ ] modello e ownership documentati;
- [ ] migration nuova;
- [ ] repository e service backend;
- [ ] route e contratto condiviso;
- [ ] permessi e RLS;
- [ ] test unitari, route e SQL;
- [ ] UI responsive e accessibile;
- [ ] audit e gestione errori;
- [ ] smoke test end-to-end.

## Fase 6 — Frontend e dashboard

- [ ] Usare i pattern visuali della landing per auth e onboarding.
- [ ] Usare `/api/backend/*` per le chiamate browser-facing.
- [ ] Eliminare gradualmente query dirette del frontend al dominio.
- [ ] Rendere la dashboard contestuale all'organizzazione attiva.
- [ ] Mostrare solo azioni compatibili con i permessi restituiti dal backend.
- [ ] Non usare la visibilità di un bottone come protezione.
- [ ] Verificare mobile, tastiera, focus-visible e stati di errore.

## Fase 7 — Verifica e rilascio

- [x] `npm run typecheck` dal root.
- [ ] `npm run lint` dal root.
- [x] Suite canonica backend (`npm test`) verde.
- [ ] `npm run build` dal root.
- [ ] E2E per registrazione, login, onboarding e cambio organizzazione.
- [ ] Test di isolamento tra utenti e tenant.
- [ ] Test di accesso negato a documenti e dati sensibili.
- [ ] Test di retry e idempotenza sulle mutazioni.
- [ ] Verifica backup, restore e migrazioni su staging.
- [ ] Checklist privacy, retention, supporto e incident response.

## Primo blocco da eseguire adesso

La prima implementazione tecnica deve essere la **Fase 1**, non il porting di
un modulo legacy:

1. definire lo schema SQL canonico;
2. definire gli stati e le relazioni tra account, profilo, organizzazione e
   membership;
3. definire la matrice iniziale ruolo-permesso;
4. approvare la migration baseline;
5. solo dopo collegare il backend e il frontend.

Questo ordine evita di costruire nuove feature sopra un modello che dovremmo
riscrivere subito dopo.

## Definition of done della fondazione

La fondazione è completa quando:

- il database locale nasce da zero con migration e seed sintetici;
- l'account è distinto dal profilo e dal soggetto;
- l'organizzazione è distinta dalla membership;
- ruoli e permessi sono contestuali e verificati server-side;
- il frontend non può scegliere l'attore o aggirare il tenant check;
- registrazione, login e onboarding sono coperti da test;
- almeno un modulo di dominio è completo end-to-end;
- typecheck, lint, test e build passano;
- documentazione e steering descrivono lo stesso comportamento.


## Domain alignment gate

Prima di portare catalogo, availability o booking, distinguere sempre:

- **APPROVED**: Patient globale, relationship scoped, ProfessionalProfile globale, RBAC scoped, TreatmentDefinition/Offering e template BBW non obbligatori.
- **TBD**: retention, qualifiche, storico globale, cancellation policy, payout.
- **BLOCKED**: consensi, pagamenti, documenti avanzati e mega state machine.
- **TECHNICAL DECISION**: le migration legacy restano archiviate; ogni nuovo modulo avrà migration canoniche additive, RLS, permission, audit e test.

Il registro è `docs/domain/decision-register.md`.
