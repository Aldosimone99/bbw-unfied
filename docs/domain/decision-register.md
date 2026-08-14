# BBW Domain Decision Register

Questo registro distingue le decisioni di dominio approvate dalle decisioni ancora aperte e dalle scelte tecniche interne. La fonte di verità di questo alignment pass è costituita dalle decisioni di dominio fornite per `Domande Progetto.pdf` e `BBW_tabella_discordanze.xlsx`; i file originali non sono presenti nel repository, quindi i riferimenti Q## riportati nella richiesta non sono verificabili localmente.

## Status

- **APPROVED** — decisione di dominio approvata e vincolante.
- **TBD** — decisione non definita; non introdurre comportamento applicativo.
- **TECHNICAL DECISION** — scelta architetturale/implementativa, non requisito business.
- **BLOCKED / WAITING DOMAIN DECISION** — implementazione sospesa in attesa di una decisione.

| ID | Domain | Decision | Status | Source | Implementation impact |
|---|---|---|---|---|---|
| ID-001 | Identity | Il professionista è un account con attributi aggiuntivi, rappresentato da `ProfessionalProfile`. | APPROVED | Domain alignment, sez. 3 | Nessuna entità Doctor separata. |
| ID-002 | Professional | `ProfessionalProfile` è globale, non organization-scoped. | APPROVED | Domain alignment, sez. 3 | Qualifiche e specializzazioni appartengono al professionista. |
| ID-003 | Professional | Un professionista può esistere senza organization e può avere uno Studio personale. | APPROVED | Domain alignment, sez. 3 | `personal_professional` resta un OperationalContext separato. |
| ID-004 | Multi-organization | Un professionista può lavorare in più organization. | APPROVED | Domain alignment, sez. 3, 30 | Membership e calendario futuro sono multi-organization. |
| AUTH-001 | Authorization | I ruoli organizzativi restano scoped alla membership. | APPROVED | Domain alignment, sez. 4 | Mantenere `organization_members → member_roles → role_permissions`. |
| AUTH-002 | Authorization | L’architettura supporta scoped roles, ma il workflow business può limitare le assegnazioni attuali. | APPROVED | Domain alignment, sez. 4 | Usare permission semantiche, non `role === "clinic"`. |
| AUTH-003 | Authorization | Ruoli e permission sono personalizzabili per organization secondo policy autorizzata. | APPROVED | Domain alignment, sez. 29 | Il mapping tecnico resta RBAC scoped. |
| PAT-001 | Patients | Patient/Subject appartiene alla piattaforma e ha una sola identità globale. | APPROVED | Domain alignment, sez. 5 | Nessuna copia del paziente per organization. |
| PAT-002 | Patients | Le relationship con organization e professional sono scoped e non autorizzano la lettura automatica dello storico altrui. | APPROVED | Domain alignment, sez. 5-6 | Mantenere entrambe le tabelle relationship e RLS scoped. |
| PAT-003 | Patients | L’origine della relationship dipende dal soggetto che ha originato l’invito/collegamento. | APPROVED | Domain alignment, sez. 7 | Persistire origin/source; non chiamarlo `data_owner`. |
| PAT-004 | Patients | Patient invitation è distinta da member invitation e crea/riattiva solo una patient relationship. | APPROVED | Domain alignment, sez. 8 | Nessuna membership o cambio OperationalContext. |
| PAT-005 | Patients | Patient deletion è logical/soft delete; audit e relazione storica restano. | APPROVED | Domain alignment, sez. 26 | Il lifecycle globale del Subject va preparato senza hard delete. |
| PAT-006 | Patients | Condivisione dello storico globale non è ancora implementata. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 6 | Non aggiungere accesso cross-organization implicito. |
| CAT-001 | Catalog | Il CSV BBW è una Treatment Library/Template Library, non un master catalog obbligatorio. | APPROVED | Domain alignment, sez. 9-12 | I template BBW sono suggerimenti; il custom è ammesso. |
| CAT-002 | Catalog | TreatmentDefinition e TreatmentOffering sono concetti distinti. | APPROVED | Domain alignment, sez. 10 | Pricing, durata e stato operativo appartengono all’offering/context. |
| CAT-003 | Catalog | Una TreatmentDefinition può essere `bbw_template`, `organization` o `professional`. | APPROVED | Domain alignment, sez. 11-13 | Source tecnico stabile e ownership coerente. |
| CAT-004 | Catalog | Organization e professional possono creare TreatmentDefinition personalizzate. | APPROVED | Domain alignment, sez. 13 | Nessuna organization fittizia per lo Studio personale. |
| CAT-005 | Catalog | Il prezzo nel template BBW è solo suggested/default price. | APPROVED | Domain alignment, sez. 14 | Non è fonte autorevole degli appuntamenti futuri. |
| CAT-006 | Catalog | Nel context organization la clinica può modificare prezzo, durata e descrizione secondo permission. | APPROVED | Domain alignment, sez. 15 | Nessuna estensione automatica a tutti i medici. |
| CAT-007 | Catalog | Le qualifiche richieste da un trattamento sono supportabili, ma la tassonomia non è definita. | APPROVED / TBD TAXONOMY | Domain alignment, sez. 16 | Preparare il modello; non creare un motore qualifiche completo. |
| APP-001 | Appointments | Appointment può inizialmente non avere professional, ma il patient deve essere registrato. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 18 | Documentare soltanto in questo pass. |
| APP-002 | Appointments | Appointment supporta zero o più treatment e zero o più professional; può essere assegnato successivamente dalla clinic. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 18 | Futuro modello con association tables. |
| APP-003 | Appointments | Reschedule mantiene lo stesso appointment id e richiede storico modifiche. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 18 | Non creare ora una state machine completa. |
| APP-004 | Appointments | Completed non è riapribile; customer non crea direttamente un appointment operativo. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 18 | Richieste cliente soggette a conferma clinic. |
| APP-005 | Appointments | Appointment conserva snapshot economici/operativi per treatment association. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 19 | Cambio listino non modifica appuntamenti esistenti. |
| AVL-001 | Availability | Availability è organization-scoped; un professional può avere orari diversi per organization. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 20 | Il modello legacy non è baseline canonica. |
| AVL-002 | Availability | Personal professional availability è uno scope tecnico separato per OperationalContext. | TECHNICAL DECISION / NOT BUSINESS DECISION | Domain alignment, sez. 21 | Supportare lo scope senza dichiararlo requisito business del PDF. |
| AVL-003 | Availability | Exceptions sovrascrivono il weekly schedule. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 22 | Futuro modello weekly availability + exceptions. |
| AVL-004 | Availability | Double booking va impedito anche tra organization diverse per lo stesso professional. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 23 | Richiede controllo transazionale/locking cross-context. |
| RES-001 | Resources | Le rooms non determinano direttamente la disponibilità; eventuali treatment resource requirements restano separati. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 24 | Non costruire room-based scheduling. |
| APP-006 | Booking policy | Cancellation terms e penali possono dipendere dalla organization. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 25 | Futuro `organization_booking_policy`; nessun 24/48h hardcoded. |
| DEL-001 | Deletion | Soft delete/revoca è il default per le entità rilevanti; l’audit non si cancella. | APPROVED | Domain alignment, sez. 26-28 | Audit append-only e stati storici. |
| RET-001 | Retention | Il periodo di purge definitivo non è approvato. | TBD | Domain alignment, sez. 27 | Nessun numero, job o purge definitivo. |
| AUD-001 | Audit | Modifiche importanti, ruoli, organization, listino e appointment devono essere tracciabili. | APPROVED / PARTIALLY IMPLEMENTED | Domain alignment, sez. 28 | Mantenere e hardenizzare l’infrastruttura audit. |
| AUD-002 | Audit | Audit è immutabile; la retention dell’audit resta TBD. | APPROVED + TBD RETENTION | Domain alignment, sez. 28 | Bloccare update/delete; non definire retention numerica. |
| PER-001 | Permissions | Clinic admin legge tutti i pazienti della clinic; professional accede ai propri; staff secondo permission/funzione. | APPROVED / PARTIALLY IMPLEMENTED | Domain alignment, sez. 29 | Aggiornare mapping, senza role-name checks. |
| PER-002 | Permissions | Export è disponibile a clinic admin e professional secondo permission. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 29 | Non implementare export in questo pass. |
| MUL-001 | Multi-organization | Il professional potrà vedere conflitti cross-organization senza vedere automaticamente i patient data dell’altra organization. | APPROVED / NOT IMPLEMENTED | Domain alignment, sez. 30 | Separare conflict visibility da data sharing. |
| CON-001 | Consents | Il dominio consensi avanzato non è sufficientemente definito. | BLOCKED / WAITING DOMAIN DECISION | Domain alignment, sez. 31 | Non sviluppare; mantenere solo scaffolding esistente. |
| PAY-001 | Payments | Il dominio pagamenti non è sufficientemente definito. | BLOCKED / WAITING DOMAIN DECISION | Domain alignment, sez. 32 | Non sviluppare. |
| DOC-001 | Professional documents | Il workflow avanzato dei documenti professionali non è definito. | BLOCKED / WAITING DOMAIN DECISION | Domain alignment, sez. 33 | Non aggiungere workflow. |
| FSM-001 | State machines | Non esiste una mega state machine generale approvata. | BLOCKED / WAITING DOMAIN DECISION | Domain alignment, sez. 34 | Definire state machine solo per modulo. |

## Decisioni tecniche interne

- **TECH-001** — PostgreSQL/Supabase resta la fonte dati; le migration nuove sono additive e non riscrivono migration applicate.
- **TECH-002** — RLS e permission server-side restano barriere complementari; il client non è fonte di autorizzazione.
- **TECH-003** — `source`/`origin` descrive l’origine del rapporto o della definizione, non ownership legale del dato.
- **TECH-004** — Le migration legacy di booking/availability/catalogo non vengono riattivate né corrette per questo pass; saranno sostituite da migration canoniche quando il dominio sarà implementato.
- **TECH-005** — I valori tecnici `bbw_template`, `organization`, `professional` non sono label UI e non devono essere esposti come copy business non tradotto.
