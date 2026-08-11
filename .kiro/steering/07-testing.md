# 07 — Strategia di test

Il repository usa Vitest 4.1.10 tramite `npm test` e contiene test unitari per validazione, password policy, mapping errori auth, auth service, session handoff, redirect sicuri, contesto autorizzativo, onboarding, permission e decisioni di accesso dashboard. Sono presenti migration/seed e regressioni SQL. L’ultima verifica registrata ha passato 74 file backend/353 test e 11 file frontend/53 test, oltre al test mirato dei grant della migration. ESLint è configurato tramite `npm run lint`; Playwright e React Testing Library non sono ancora installati nel repository.

## Livelli

- **Type checking**: `tsc --noEmit` su ogni change.
- **Lint/format**: ESLint tramite `npm run lint`; la configurazione Next passa senza errori, con warning residui da valutare per la migrazione da `<img>` a `next/image`.
- **Unit**: Vitest per funzioni pure, validatori Zod, policy, transizioni di stato, mapping e servizi con dipendenze mockate.
- **Integration**: Vitest + Supabase/PostgreSQL locale per casi d’uso, repository, transazioni e error mapping.
- **Database/RLS**: SQL test o harness Supabase locale con utenti e membership di test; verificare anonimo, tenant corretto, altro tenant, revocato e ruolo insufficiente.
- **Component**: React Testing Library per form, stati, messaggi, tastiera e callback; non testare implementazione CSS interna.
- **E2E**: Playwright per browser reale, sessioni, redirect, flussi critici e responsive smoke.
- **Smoke/regression**: percorso marketing, callback auth, dashboard protetta e risposte principali dopo deploy.
- **Security**: test negativi IDOR, escalation, upload, rate limit, webhook replay, header, secret exposure e redazione log; penetration test esterno quando necessario.
- **Migration**: reset da zero, applicazione ordinata, seed idempotente, upgrade da snapshot precedente e verifica RLS/indici.

## Strumenti

Vitest è lo strumento attuale per unit e service test; Supabase CLI/PostgreSQL locale coprono migration, seed e policy SQL. React Testing Library e Playwright restano candidati da introdurre per component/E2E; le scelte definitive di CI e database harness sono **Da confermare**.

## Primi flussi E2E

1. registrazione valida e gestione input invalido;
2. login e session handoff;
3. onboarding e completamento profilo;
4. assegnazione o selezione del contesto organizzativo;
5. accesso alla dashboard autorizzata;
6. rifiuto dell’accesso non autorizzato e tentativo con altro tenant;
7. logout e invalidazione della sessione;
8. recupero password e ritorno sicuro al flusso di accesso.

I flussi login, registrazione account-first senza codice email in locale, session handoff, onboarding, redirect, accesso/negazione dashboard e selezione server-side del contesto hanno una prima implementazione e test server/unitari. Il percorso personale registrazione → onboarding → scelta “Cliente” → dashboard è stato verificato manualmente nel browser locale. Restano da coprire end-to-end automatizzati il ripristino della verifica email, il cambio contesto, recupero password, inviti e gestione operativa delle organizzazioni.

## Regole di regressione

Ogni bug dovrebbe aggiungere un test che riproduca il comportamento corretto, a livello più vicino possibile alla causa. Prima di modificare un test, verificare se il comportamento attuale o l’aspettativa sono sbagliati; non cambiare un’asserzione solo per far passare l’implementazione. I test di autorizzazione devono coprire sempre il caso positivo e almeno un confine negativo.

## Qualità del test

Test deterministici, dati sintetici, clock/ID random controllabili, cleanup esplicito e nessun segreto reale. Evitare mock che nascondono policy database o contratti provider. Un test verde non sostituisce review di RLS, UX, accessibilità e privacy.
