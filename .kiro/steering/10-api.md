# 10 — Contratti API

Questo file completa l’architettura: il contratto HTTP non è il modello di dominio e PostgREST non è l’API applicativa completa. Route Handler e Server Action riusano gli stessi service server.

Stato attuale: il repository espone il callback Auth come Route Handler e usa Server Actions interne per login, registrazione, onboarding e cambio dell’organizzazione attiva. Non sono ancora presenti API Route Handler pubbliche per organizzazioni, appuntamenti, consensi, file o notifiche.

Il backend Express espone già il percorso identity/onboarding usato dal frontend:

| Endpoint | Scopo | Nota autorizzativa |
| --- | --- | --- |
| `POST /auth/register` | crea account Auth e dati iniziali | non accetta tipo di account o ruolo dal client |
| `POST /auth/login` | verifica le credenziali e restituisce la sessione Supabase | il frontend salva access/refresh token nel client SSR; non esegue una seconda password sign-in |
| `POST /auth/onboarding/profile` | salva nome, cognome e telefono | richiede Bearer verificato e agisce sull'account corrente |
| `POST /auth/onboarding/complete` | completa onboarding tramite RPC transazionale | il tipo richiesto non concede da solo privilegi; organization crea anche membership owner |
| `GET /auth/me` | restituisce il profilo applicativo verificato | richiede Bearer token verificato |
| `GET /auth/context` | restituisce profilo, membership, permission e readiness derivato | accetta opzionalmente il contesto organizzativo richiesto, sempre riverificato contro membership attiva |
| `GET /organizations/:organizationId/profile` | legge dati legali/contatto dell’organizzazione | richiede membership verificata e permission scoped |
| `PUT /organizations/:organizationId/profile` | aggiorna dati legali/contatto dell’organizzazione | richiede membership, `organization.update` e audit minimizzato |

Le chiamate browser-facing passano tramite `/api/backend/*`; le Server Actions auth/onboarding possono usare direttamente il backend configurato perché eseguono solo sul server. I contratti condivisi vivono in `packages/interfaces`.

## Convenzioni

- path in minuscolo e kebab-case, versionamento solo se serve compatibilità;
- identificativi UUID validati; paginazione cursor-based quando l’elenco può crescere;
- filtri e sort allowlisted, mai query SQL o colonne arbitrarie dal client;
- `Content-Type` e cache espliciti; niente dati personali in query string se non necessario;
- mutation sensibili idempotenti dove possibile tramite idempotency key;
- correlation id propagato e redatto nei log.

## Request

Ogni request definisce schema Zod per path params, query, headers e body. Il server deriva account e contesto dalla sessione; `organization_id`, `actor_id`, permission e ownership inviati dal client non sono autorevoli. Limiti di dimensione, rate limit e timeout sono parte del contratto operativo.

Per il Context Switcher, `organizationId` arriva a `setActiveOrganizationAction` come input di form, viene validato con Zod e riverificato dal service tramite membership attiva prima di essere scritto nel cookie HttpOnly.

## Response

Le risposte di successo hanno forma stabile e DTO minimizzati, ad esempio `{ data, meta }`; le liste dichiarano cursore/has-more. Non restituire righe Supabase, token, policy interne o campi non necessari. Il caching deve rispettare dati personali e invalidazione.

## Errori e status code

- `400` input malformato;
- `401` sessione assente/non valida;
- `403` autenticato ma senza permission/scopo;
- `404` risorsa non presente o non rivelabile secondo la policy;
- `409` conflitto di stato, unique o concorrenza;
- `413` payload/file oltre limite;
- `422` input semanticamente non accettabile, se distinto dal 400;
- `429` rate limit;
- `500/502/503` errore interno o dipendenza, senza dettagli segreti.

Forma errore candidata: `{ error: { code, message, requestId, fieldErrors? } }`. I codici sono stabili e documentati; i messaggi possono essere localizzati. La distinzione 400/422 e la strategia 404 vs 403 per risorse sensibili sono **Da confermare**.

## Endpoint sensibili

Webhook verificano firma e replay; download richiede autorizzazione al momento della richiesta; callback OAuth valida `next` contro open redirect; admin/supporto richiede motivo e audit. Nessun endpoint bypassa RLS usando la service role senza un adapter server motivato.

## Compatibilità

Modifiche breaking richiedono versione o migrazione coordinata. Aggiornare documentazione, test contract e consumer prima del deploy. Non creare API pubblica per funzionalità non approvate nel prodotto.
