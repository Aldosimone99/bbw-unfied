# 02 — Modello di dominio

## Regola di base

Identità, persona, organizzazione, appartenenza, ruolo, permesso, ownership e relazione sono concetti diversi. Un’etichetta visibile come “clinica”, “professionista” o “paziente” non può essere usata direttamente per autorizzare una richiesta.

## Entità e stato di decisione

| Entità | Significato e relazioni | Stato |
| --- | --- | --- |
| **Account** | Identità autenticata da Supabase Auth; ha un `auth_user_id` e può avere un solo profilo applicativo. Non contiene dati di dominio non necessari all’autenticazione. | MVP proposto |
| **Profile** | Dati personali applicativi dell’account; separato da email, password e token. Può essere collegato a più membership. | MVP proposto |
| **Organization** | Confine di proprietà e collaborazione per struttura, studio, rete o altro soggetto collettivo. | MVP proposto |
| **OrganizationType** | Catalogo/configurazione che descrive il tipo di organizzazione senza concedere permessi. | Da confermare |
| **OrganizationMembership** | Relazione account-organizzazione, con stato, date e assegnazioni; un account può appartenere a più organizzazioni. | MVP proposto |
| **Role** | Nome configurabile assegnabile in un contesto; non è sufficiente da solo per autorizzare. | MVP proposto |
| **Permission** | Capacità semantica stabile, ad esempio `appointments.read` o `consents.sign`. | MVP proposto |
| **UserRoleAssignment** | Assegnazione di ruolo a una membership, eventualmente limitata a una risorsa/ambito. | MVP proposto |
| **PatientRelationship** | Relazione esplicita tra soggetto/persona e professionista o organizzazione, con stato, origine, consenso dove richiesto e revoca. | MVP proposto |
| **ProfessionalProfile** | Qualifiche e dati pubblicabili di una persona professionista; verifica e visibilità sono separate dall’account. | Da confermare / MVP proposto |
| **OperationalReadiness** | Vista derivata, non persistita, dei prerequisiti per una capability: completezza personale, organization context e verifica professionale restano dimensioni separate. | Foundation implementata |
| **Appointment** | Evento con organizzazione/owner, partecipanti, servizio, orari e stato. Gli orari sono istanti con timezone esplicita. | MVP proposto |
| **Service/Treatment** | Prestazione o percorso offerto; “treatment” può implicare dati clinici e va definito. | Da confermare |
| **ConsentTemplate** | Versione di un testo/modello predisposto da un soggetto autorizzato. Le versioni pubblicate sono immutabili. | MVP proposto |
| **ConsentDocument** | Istanza del template presentata a un soggetto, con snapshot/versione e stato. | MVP proposto |
| **Signature** | Evidenza di un’azione di firma associata a documento, soggetto, timestamp e prova tecnica; valore giuridico da confermare. | Da confermare |
| **Attachment** | Metadata di un file in Storage privato; l’oggetto non è accessibile solo perché se ne conosce l’ID. | MVP proposto |
| **Notification** | Messaggio derivato da un evento, destinatario, canale e stato di consegna. | MVP proposto |
| **AuditEvent** | Record append-only di operazioni sensibili, attore, contesto, esito e risorsa; senza payload sensibile non necessario. | MVP proposto |

## Cardinalità e ownership

- Un **Account** ha al massimo un **Profile** applicativo e zero o più **OrganizationMembership**.
- Una **Organization** ha zero o più membership, servizi, appuntamenti e template propri.
- Una membership appartiene a un solo account e a una sola organizzazione; può avere più assegnazioni di ruolo.
- La foundation implementata supporta zero, una o più membership e zero, uno o più professional profile per account. L’OperationalContext attivo può essere `personal_professional` o `organization`; non cambia ownership o appartenenza e non sostituisce la verifica server-side di professional profile, membership, ruolo o permission.
- Un **Role** contiene più permission e una permission può appartenere a più ruoli.
- Una relazione paziente può coinvolgere più professionisti/organizzazioni e deve avere un owner o contesto esplicito.
- Un appuntamento appartiene a un contesto organizzativo o a un owner definito; i partecipanti sono relazioni, non una stringa di ruolo.
- Un documento deriva da una versione di template; firme e allegati appartengono al documento o a una risorsa con policy esplicita.
- AuditEvent è append-only e riferisce l’attore e la risorsa quando possibile, senza diventare un archivio indiscriminato di dati clinici.

## Confini funzionali

1. **Identity & access**: Account, sessioni, Profile minimo, membership e autorizzazione.
2. **Organizations**: organizzazioni, inviti, ruoli contestuali e ownership.
3. **Relationships & care journey**: relazioni, servizi, appuntamenti e stati.
4. **Consents & files**: template versionati, documenti, firme e allegati.
5. **Notifications & audit**: eventi derivati, consegne e tracciabilità.

Le transazioni che cambiano più aggregate devono essere coordinate da un caso d’uso server. Non introdurre un aggregate formale se non chiarisce davvero ownership, invarianti o consistenza.

## Invarianti iniziali

- un account disabilitato non può creare sessioni operative;
- una membership revocata non produce permessi effettivi;
- un ruolo non concede accesso al di fuori dell’organizzazione o dell’ambito assegnato;
- un documento pubblicato conserva il testo/versione presentato alla firma;
- una firma non modifica retroattivamente il documento firmato;
- appuntamenti con intervalli incompatibili sono rifiutati secondo la policy approvata;
- un allegato non è scaricabile senza verificare ownership/relazione e permesso;
- un AuditEvent non viene aggiornato o cancellato per correggere una storia;
- ogni riferimento applicativo a una risorsa deve rispettare foreign key e tenant boundary.

## Stati e transizioni da definire

Gli stati devono essere cataloghi o costanti di dominio, non stringhe sparse. Candidati: membership `invited → active → suspended/revoked`; relazione `pending → active → ended/revoked`; appuntamento `requested → confirmed → completed/cancelled/no_show`; documento `draft → presented → signed/declined/expired`. I nomi, gli attori autorizzati e le transizioni effettive sono da confermare.

## Termini da evitare

Non usare `User` per indicare indiscriminatamente account/profile; non usare `ClinicUser` come modello universale; non usare `role` come prova sufficiente; non usare `patient_id` quando la relazione può coinvolgere un soggetto diverso o più contesti; non usare `treatment` finché non è chiarito se rappresenta un servizio commerciale, un percorso clinico o entrambi.

## Non ancora deciso

Vanno confermati per il prodotto completo: gestione di minori/deleghe; separazione tra dati identificativi e sanitari; vocabolario definitivo dei tipi; versionamento dei consensi; natura della firma; ricorrenza e timezone degli appuntamenti; ownership di documenti e allegati; retention e cancellazione; eventuale interoperabilità sanitaria. La membership multi-organizzazione e il contesto attivo sono invece implementati nella foundation Identity & Authorization.


## DOMAIN DECISION STATUS — Domain Alignment Pass

### APPROVED

- Patient/Subject appartiene alla piattaforma e ha una sola identità globale.
- `organization_patient_relationships` e `professional_patient_relationships` restano scoped.
- ProfessionalProfile è globale; qualifiche e specializzazioni appartengono al professionista.
- Un professional può lavorare in più organization e avere Studio personale.
- TreatmentDefinition è distinta da TreatmentOffering.
- Una TreatmentDefinition può essere template BBW, organization-owned o professional-owned.
- Appointment futuro supporta più treatment e più professional, con professional inizialmente opzionale.
- Availability futura è organization-scoped; le eccezioni sovrascrivono il weekly schedule.
- Soft delete e audit sono il default per le entità rilevanti.

### TBD / BLOCKED

Restano TBD la tassonomia delle qualifiche, la condivisione dello storico globale, la retention, i consensi, i pagamenti, i documenti professionali avanzati e le state machine complete.

### TECHNICAL DECISION

`source`/`origin` descrive la provenienza della relationship o della definition, non la titolarità legale dei dati. Ruoli e permission restano contestuali alla organization; non usare etichette come `clinic` o `doctor` per autorizzare.

Il registro vincolante è `docs/domain/decision-register.md`.
