# 04 — Autenticazione e autorizzazione

## Principio

Autenticazione significa “chi è l’account”; autorizzazione significa “che cosa può fare, su quale risorsa e in quale contesto”. BBW deve verificare entrambe lato server e database. La UI può nascondere un’azione, ma non può concedere o negare da sola un diritto.

## Supabase Auth

Supabase Auth è il provider usato per email/password e sessioni. Il repository contiene client browser/server, `src/proxy.ts` per il refresh della sessione e un callback che scambia un code per sessione. Login e registrazione passano dal backend Express: il frontend Server Action riceve la sessione verificata e la salva con `supabase.auth.setSession(...)` nel client SSR. Onboarding e contesto autorizzativo usano il Bearer token verificato dal backend. In locale `enable_confirmations = false` e il backend crea l'account confermato per consentire il bootstrap senza codice email; è una configurazione temporanea locale, non un requisito di produzione. Il recupero password non è ancora un flusso applicativo completo.

Sessioni: cookie gestiti dal client server-side, refresh rotation attiva negli ambienti locali, user/session ricostruita a ogni richiesta sensibile. Non usare dati decodificati dal client come attestazione sufficiente. MFA, passkey, durata sessione e gestione dispositivi sono **Da confermare**; MFA è raccomandata almeno per ruoli operativi ad alto impatto.

## Registrazione e onboarding

La registrazione mostra inizialmente solo email, password, conferma password e consensi, come nel frontend `bbwlanding`; non chiede tipo di account, nome, codice fiscale o organizzazione. Crea prima un account Auth e poi il profilo applicativo in modo idempotente. Dopo il primo login l'account incompleto viene inviato all'onboarding, che raccoglie solo i dati necessari e completa profilo/contesto con un caso d'uso server. La verifica email va reinserita prima di ambienti non locali.

L’onboarding implementato salva in un primo passaggio nome, cognome e telefono opzionale su `profiles`. Il secondo passaggio salva l’intento (`personal`, `healthcare_professional`, `beauty_professional`, `organization` o `commercial`) senza usarlo come ruolo. Le etichette UI legacy come “cliente” vengono normalizzate a `personal` lato server. Il completamento passa dalla RPC transazionale `complete_account_onboarding`: il tipo `organization` crea organizzazione e membership owner; gli altri tipi completano il profilo senza cambiare automaticamente il ruolo operativo. Un account può avere più membership; il backend restituisce permission globali e permission dell’organizzazione attiva separatamente. Gli inviti usano `invitations` con token hash e le identità professionali usano `professional_profiles` con verifica esplicita.

La password di registrazione richiede almeno 8 caratteri, maiuscola, minuscola, numero e carattere speciale. La lunghezza minima è una regola di prodotto attuale; non va indebolita per risolvere errori di onboarding.

Inviti: token monouso, scadenza, destinatario verificato, organizzazione e ruolo proposto; accettazione autenticata e revoca tracciata. Questo è ancora **Da confermare/MVP proposto**. L’invitante non può assegnare permission superiori al proprio perimetro.

## Modello di accesso

Il modello iniziale è RBAC contestuale con permission semantiche e controlli di ownership/relazione. RBAC evita di spargere ruoli nominali nel codice; da solo non basta per dati relazionali o multi-tenant. Non introdurre un motore ABAC complesso finché non esistono casi che lo richiedono.

Esempi di permission candidate:

| Permission | Significato |
| --- | --- |
| `appointments.read/create/update/cancel` | leggere o modificare appuntamenti nel contesto autorizzato |
| `patients.read` | leggere dati di soggetti con relazione/ambito consentito |
| `patients.relationships.manage` | creare, revocare o aggiornare relazioni |
| `organization.members.read/manage` | leggere o amministrare membership senza superare il proprio livello |
| `organization.settings.manage` | modificare impostazioni dell’organizzazione |
| `services.read/manage` | leggere o gestire servizi nel contesto |
| `consents.read/create/review/sign` | gestire il ciclo del consenso secondo soggetto autorizzato |
| `attachments.read/upload/delete` | usare file dopo controllo di ownership e retention |
| `audit.read` | consultare audit minimizzato e nel perimetro assegnato |

Questa è una **matrice iniziale da approvare**, non lo schema definitivo. Ogni permission deve essere associata a risorsa, contesto e condizioni; `patients.read` globale, per esempio, non è accettabile come accesso indiscriminato.

## Enforcement e revoca

Il backend `/auth/context` calcola il contesto da Bearer verificato, profilo, membership, stato organizzazione e readiness derivato. Il readiness non è un ruolo, una permission né un flag client-side: serve a valutare prerequisiti dichiarati dopo authentication, tenant context e permission. La dashboard applica già le decisioni `login`, `onboarding`, `forbidden` e `allowed`; RLS resta il confine database. I permessi sono separati tra global/platform e organizzazione attiva; una membership non attiva o un’organizzazione non attiva non produce permessi scoped. Il frontend usa il contesto ricevuto per il rendering, ma non decide autorizzazioni.

Revoca membership/ruolo, sospensione account e disabilitazione devono avere effetto sulle richieste successive; definire se e come invalidare sessioni già aperte. Un errore di ownership non deve essere aggirabile cambiando un UUID.

## Contesto operativo attivo

Il punto centrale di lettura è l’`OperationalContext` backend-authoritative. Le varianti canoniche sono `personal_professional`, derivata esclusivamente da un `ProfessionalProfile` owned e operativo, e `organization`, derivata da membership attiva e organizzazione attiva. Il cookie `bbw-active-operational-context` è HttpOnly, SameSite `lax`, con durata limitata e contiene soltanto una reference tecnica `{ kind, id }`: non è una prova di autorizzazione. Il server valida input, sessione, ownership/membership e stato operativo prima di salvarlo e risolve ruoli/permission solo dopo questa verifica. Se esiste un solo contesto disponibile viene auto-selezionato; se ne esistono più di uno, un cookie assente, invalido o non più autorizzato richiede una scelta esplicita. Non si seleziona mai silenziosamente il primo contesto disponibile.

## Super-admin e supporto

Il seed e le migration prevedono il ruolo platform `platform_admin` e la permission `platform.admin.access`, ma non esiste ancora una UI/admin area completa. Il super-admin è un ruolo operativo eccezionale, non una scorciatoia per vedere tutti i dati sanitari o personali. Accesso elevato: motivazione obbligatoria, scope limitato, durata breve quando possibile, audit immutabile e revisione. La procedura, i casi ammessi e l’eventuale break-glass sono **Da confermare**.

## Prevenzione escalation

Il client non può scegliere permission arbitrarie, organizzazione arbitraria o ruolo superiore. Il server confronta l’autorità dell’attore con quella assegnata, limita gli scope e applica invarianti in transazione. Mai derivare privilegi da claim non verificati, testo del form, pathname o nome visualizzato.

## Workspace switcher globale

Il cambio workspace è esposto dalla navigation globale, ma resta un'operazione server-authoritative. Il componente client può mostrare `availableOperationalContexts` e inviare `{ kind, id }`; il server deve riverificare sessione, ownership del professional profile oppure membership attiva, stato dell'organizzazione e permission prima di aggiornare il cookie HttpOnly.

Dopo una selezione valida il contesto, i ruoli e le permission operative vengono ricalcolati e la pagina viene riportata alla dashboard del nuovo workspace. Un riferimento manipolato, una membership revocata o un contesto non più disponibile non cambia il workspace attivo precedente e produce un errore user-facing. Il workspace attivo non è l'account e non è una prova di autorizzazione.


## DOMAIN DECISION STATUS — Domain Alignment Pass

**APPROVED**: professional può lavorare in più organization; i ruoli restano scoped alla membership; patient access è relationship/permission scoped; clinic admin, professional e staff hanno capacità diverse; export e role assignment devono essere permission-based.

**TBD / NON IMPLEMENTATO**: permission export, conflict visibility cross-organization, payout e policy completa di condivisione dello storico.

**TECHNICAL DECISION**: mantenere `organization_members → member_roles → role_permissions`; il business può limitare gli abbinamenti consentiti senza trasformare `role` in attributo globale del professional. I middleware legacy role-name-based restano non canonici e disabilitati.
