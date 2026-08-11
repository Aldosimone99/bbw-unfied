# 04 — Autenticazione e autorizzazione

## Principio

Autenticazione significa “chi è l’account”; autorizzazione significa “che cosa può fare, su quale risorsa e in quale contesto”. BBW deve verificare entrambe lato server e database. La UI può nascondere un’azione, ma non può concedere o negare da sola un diritto.

## Supabase Auth

Supabase Auth è il provider usato per email/password e sessioni. Il repository contiene client browser/server, `src/proxy.ts` per il refresh della sessione e un callback che scambia un code per sessione. Login, registrazione e onboarding passano da Server Actions e servizi server con validazione Zod. La registrazione gestisce il caso di conferma email; il recupero password non è ancora un flusso applicativo completo e il link attuale è un contatto email.

Sessioni: cookie gestiti dal client server-side, refresh rotation attiva negli ambienti locali, user/session ricostruita a ogni richiesta sensibile. Non usare dati decodificati dal client come attestazione sufficiente. MFA, passkey, durata sessione e gestione dispositivi sono **Da confermare**; MFA è raccomandata almeno per ruoli operativi ad alto impatto.

## Registrazione e onboarding

La registrazione crea prima un account Auth e poi il profilo applicativo in modo idempotente. Il tipo scelto in UI (“Paziente”, “Professionista”, “Clinica”) non deve diventare automaticamente un ruolo privilegiato. L’onboarding deve raccogliere solo dati necessari, verificare email e completare il profilo/contesto con un caso d’uso server.

L’onboarding implementato salva in un primo passaggio nome, cognome e telefono opzionale, portando il profilo a `account_type_required`. Il secondo passaggio salva il tipo richiesto (`personal`, `healthcare_professional`, `beauty_professional`, `organization` o `commercial`) senza usarlo come ruolo. `personal`, professionisti e commerciale ricevono soltanto il ruolo platform base necessario all’accesso iniziale; professionisti e commerciale restano `account_type_status = pending`. Il tipo `organization` crea in una funzione transazionale organizzazione, membership attiva e assegnazione `organization_owner`, risolvendo tipo e ruolo tramite `code`. Un account può ora avere più membership: l’organizzazione attiva viene risolta server-side e cambiata dal Context Switcher. Gli inviti non sono ancora implementati.

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

Il service/repository server calcola il contesto da sessione, cookie attivo, membership e account role. La dashboard applica già le decisioni `login`, `onboarding`, `forbidden` e `allowed`; RLS applica il confine database anche se una query viene invocata direttamente. I permessi sono separati tra global/platform e organizzazione attiva; una membership non attiva o un’organizzazione non attiva non produce permessi scoped. Le policy consentono letture limitate di profilo proprio, organizzazioni/membership e mapping di ruoli/permission; gestione operativa di inviti, modifica membership e revoca da UI non sono ancora implementate.

Revoca membership/ruolo, sospensione account e disabilitazione devono avere effetto sulle richieste successive; definire se e come invalidare sessioni già aperte. Un errore di ownership non deve essere aggirabile cambiando un UUID.

## Contesto attivo

Il punto centrale di lettura è `getActiveOrganization()`. Il cookie `bbw-active-organization` è HttpOnly, SameSite `lax`, con durata limitata e non è una prova di autorizzazione. `setActiveOrganization()` valida input, sessione, membership attiva e stato dell’organizzazione prima di salvarlo. Se il cookie manca, è invalido o non più autorizzato, il server sceglie la prima organizzazione attiva secondo l’ordinamento stabile delle membership oppure `null`.

## Super-admin e supporto

Il seed e le migration prevedono il ruolo platform `platform_admin` e la permission `platform.admin.access`, ma non esiste ancora una UI/admin area completa. Il super-admin è un ruolo operativo eccezionale, non una scorciatoia per vedere tutti i dati sanitari o personali. Accesso elevato: motivazione obbligatoria, scope limitato, durata breve quando possibile, audit immutabile e revisione. La procedura, i casi ammessi e l’eventuale break-glass sono **Da confermare**.

## Prevenzione escalation

Il client non può scegliere permission arbitrarie, organizzazione arbitraria o ruolo superiore. Il server confronta l’autorità dell’attore con quella assegnata, limita gli scope e applica invarianti in transazione. Mai derivare privilegi da claim non verificati, testo del form, pathname o nome visualizzato.
