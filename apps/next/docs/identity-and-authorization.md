# Identity & Authorization — Registro delle modifiche

Questo documento tiene traccia delle modifiche importanti al perimetro di identità, onboarding e autorizzazione di Beauty Broker World. Va aggiornato quando cambiano registrazione, login, onboarding, sessioni, ruoli, permessi, RLS o migration collegate.

## Stato attuale

Ultimo aggiornamento: 2026-08-10

Il flusso implementato è:

```text
account autenticato
  → profilo incompleto
  → /onboarding
  → dati personali
  → tipo di esperienza richiesto
  → eventuale organizzazione e membership owner
  → una o più membership organizzative
  → risoluzione server-side dell’organizzazione attiva
  → /dashboard
```

La dashboard applicativa resta una superficie temporanea. Mostra ora, a scopo tecnico, organizzazione attiva, membership, ruoli, permission e organizzazioni disponibili; il server resta la fonte autorevole e il client non concede accesso.

## Modifiche implementate

### Onboarding

- Primo step con `first_name`, `last_name` e `phone` opzionale.
- Validazione Zod con trim, limiti di lunghezza e controllo del formato telefonico.
- Dopo il primo step `profiles.onboarding_status` diventa `account_type_required`.
- Secondo step con i tipi richiesti:
  - `personal`
  - `healthcare_professional`
  - `beauty_professional`
  - `organization`
  - `commercial`
- Il tipo richiesto non è un ruolo di autorizzazione.
- Per professionisti e commerciale il profilo viene completato, ma `account_type_status` resta `pending`; l’abilitazione operativa è un workflow separato.

### Organizzazioni

Per `organization`, la funzione PostgreSQL `complete_account_onboarding` esegue in una singola transazione:

```text
organization
  → organization_member active
  → member_role organization_owner
  → profile completed
```

Il tipo di organizzazione e il ruolo vengono risolti tramite `code`, mai tramite UUID hardcoded. Per rispettare il perimetro minimo attuale, `legal_name` viene valorizzato con lo stesso valore di `display_name`; non vengono richiesti P.IVA, documenti, ASL, IBAN o contratto.

### Database e RPC

La migration principale è:

`supabase/migrations/20260808000100_onboarding_account_type.sql`

Introduce o aggiorna:

- `profiles.account_type_status`;
- lo stato `account_type_required`;
- il tipo richiesto `commercial`;
- `save_onboarding_profile(...)`;
- `complete_account_onboarding(...)`;
- privilegi di aggiornamento del profilo limitati ai dati personali;
- grant/revoke per le funzioni autenticato-only.

Le migration locali e quelle del progetto Supabase collegato risultano allineate. Verificare sempre con:

```bash
supabase migration list
```

Applicazione locale senza reset:

```bash
supabase migration up --local
```

Applicazione al progetto collegato:

```bash
supabase migration up --linked
```

### Guard e autorizzazione

- account non autenticato → `/login`;
- onboarding non completato → `/onboarding`;
- account completato che apre `/onboarding` → `/dashboard`;
- dashboard e superfici platform richiedono `dashboard.access` tramite guard server-side;
- non esistono controlli applicativi basati su confronti diretti del nome del ruolo.

### Membership e contesto attivo

- `getUserMemberships(userId)` carica organizzazione, tipo, membership, stato e ruoli contestuali;
- `getAccessibleOrganizations(userId)` restituisce solo membership attive in organizzazioni attive;
- `getMembershipForOrganization({ userId, organizationId })` e `requireOrganizationMembership(...)` verificano l’appartenenza lato server;
- `getActiveOrganization()` legge il contesto risolto dal server;
- `setActiveOrganization()` valida UUID, sessione, membership attiva e stato dell’organizzazione prima di salvare il cookie HttpOnly `bbw-active-organization`;
- cookie assente, invalido o non più autorizzato → prima organizzazione attiva secondo ordinamento deterministico, oppure `null`;
- permessi platform/global e permessi dell’organizzazione attiva sono calcolati separatamente;
- il Context Switcher usa `setActiveOrganizationAction`, revalidation e redirect a `/dashboard`.

Gli helper di autorizzazione da mantenere sono:

- `getCurrentUser()`;
- `getCurrentProfile()`;
- `getUserMemberships()`;
- `getUserPermissions()`;
- `can()`;
- `requirePermission()`.

### Dashboard

La dashboard mostra la superficie operativa temporanea: saluto, azioni rapide, profilo, calendario, prenotazioni, riepilogo account e riepilogo tecnico del contesto attivo. Il Context Switcher è presente nella shell platform; non sono ancora implementate dashboard operative separate per clinica, professionista o cliente.

## File principali

- `src/app/(auth)/onboarding/page.tsx` — guard e composizione onboarding;
- `src/features/auth/OnboardingForm.tsx` — form a due step;
- `src/features/auth/actions.ts` — Server Action;
- `src/server/services/auth-service.ts` — casi d’uso onboarding;
- `src/server/services/membership-service.ts` — membership e organizzazioni accessibili;
- `src/server/services/active-organization-service.ts` — risoluzione e scrittura del contesto attivo;
- `src/server/repositories/authorization-repository.ts` — mapping profilo/cataloghi;
- `src/server/authorization/` — contesto, permessi e access decision;
- `src/features/organizations/` — Context Switcher e Server Action;
- `src/features/dashboard/` — dashboard e guard platform;
- `src/lib/validation/` — schemi Zod;
- `supabase/migrations/` — schema e funzioni PostgreSQL;
- `supabase/tests/authorization.sql` — regressioni RLS.

## Verifiche eseguite

- `npm run typecheck`;
- `npm run test` — 55 test passati;
- `npm run lint` — 0 errori, 7 warning `@next/next/no-img-element`;
- `npm run build`;
- `git diff --check`;
- `supabase test db --local supabase/tests/authorization.sql` — 9 assertion pgTAP passate;
- E2E browser non eseguito: il backend Browser in-app non risultava disponibile nella sessione.

## Registro modifiche

### 2026-08-08 — Onboarding minimo e autorizzazione

- Implementati onboarding dati personali e tipo di esperienza.
- Aggiunti stato intermedio `account_type_required` e stato richiesta `pending`.
- Aggiunta creazione atomica organizzazione, membership e owner role.
- Aggiornate guard server-side e dashboard temporanea.
- Applicata la migration locale e al progetto Supabase collegato.
- La dashboard diagnostica è stata successivamente estesa con il riepilogo tecnico del contesto attivo.

### 2026-08-10 — Membership multi-organizzazione e active context

- Centralizzato il membership service con organizzazione, tipo, stato e ruoli contestuali.
- Implementata l’organizzazione attiva con cookie HttpOnly server-managed e fallback deterministico.
- Aggiunti Context Switcher, Server Action, validazione membership e revalidation.
- Separati permessi global/platform da permessi dell’organizzazione attiva.
- Aggiunti helper `getActiveOrganization`, `requireOrganizationMembership` e `requireOrganizationPermission`.
- Aggiornata la regressione SQL RLS per isolamento membership e assenza di scritture dirette.
- Aggiunti test per cookie invalido, selezione non autorizzata, membership rimossa e isolamento dei permessi tra organizzazioni.
- Verificati typecheck, lint, 55 test Vitest, build e regressione SQL RLS locale; E2E browser ancora da eseguire quando sarà disponibile un backend Browser.

## Regola per le prossime modifiche importanti

Quando cambiano registrazione, login o altri flussi sensibili, aggiungere una nuova voce al registro indicando:

1. data e obiettivo;
2. file e migration modificati;
3. comportamento osservabile e redirect;
4. impatto su Auth, profili, ruoli, permessi o RLS;
5. test e comandi di verifica;
6. eventuali migration da applicare in locale e online;
7. decisioni ancora da confermare.

Non modificare migration già applicate: creare sempre una nuova migration numerata.
