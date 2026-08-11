# 03 — Database

## Fonte e stato

PostgreSQL tramite Supabase è la fonte dei dati applicativi. Nel monorepo la fonte operativa è `apps/backend/supabase/`, con `config.toml`, migration applicate in ordine, seed e regressioni SQL RLS. Il database implementato è la fondazione identity/authorization e il backend di transizione; non è ancora lo schema completo di BBW.

Le migration attuali introducono `profiles`, `organization_types`, `organizations`, `organization_members`, `roles`, `permissions`, `role_permissions`, `member_roles` e `account_roles`, con UUID, timestamp UTC, foreign key, indici, check constraint, trigger `updated_at`, RLS e funzioni controllate per la creazione profilo, il salvataggio dei dati onboarding, il completamento del tipo richiesto e l’assegnazione dei ruoli base/owner. `profiles.onboarding_intent` rappresenta il tipo richiesto dall’account, mentre `profiles.account_type_status` separa una richiesta pending dall’autorizzazione. L’organizzazione attiva non è una colonna applicativa: viene mantenuta in un cookie HttpOnly server-managed, sempre riverificato contro il database. Non esistono ancora tabelle per appuntamenti, servizi/trattamenti, consensi, firme, allegati, notifiche o audit event.

## Convenzioni

- nomi SQL in `snake_case`, singolare o plurale da fissare nel primo schema e mantenere coerente;
- UUID per identificativi esposti o riferimenti cross-system; generazione lato database o libreria affidabile;
- timestamp in UTC con tipo coerente, preferibilmente `timestamptz`; convertire solo nel boundary di presentazione;
- foreign key esplicite con azione `on delete` scelta per ogni relazione;
- `not null`, `unique`, `check` e vincoli di dominio nel database quando l’invariante è strutturale;
- `id`, `created_at` e `updated_at` solo quando hanno un significato reale per quella tabella, non per automatismo;
- dati applicativi separati dalle tabelle gestite da Supabase Auth;
- enum PostgreSQL solo per valori stabili; cataloghi/tabelle per valori configurabili o soggetti a workflow.

## Multi-tenancy e ownership

Ogni tabella che contiene dati organizzativi deve avere un collegamento verificabile al tenant/contesto, direttamente o attraverso un percorso di foreign key non ambiguo. Le policy RLS devono filtrare per membership, permission, ownership o relazione esplicita. Non basta ricevere `organization_id` dal client: il server deve derivare o validare il contesto dall’identità e le query devono restare soggette a RLS.

Per evitare dati orfani: foreign key obbligatorie dove il figlio non ha senso senza il padre, transazioni per creazioni aggregate, `on delete restrict` per dati da conservare, `cascade` solo per dipendenze veramente subordinate e job di riconciliazione per risorse esterne. I dati clinici o firmati non vanno eliminati in cascata senza policy approvata.

## Indici e vincoli

Indicizzare foreign key, colonne usate nei filtri RLS e query operative reali; evitare indici speculativi e valutare il costo di scrittura. Unique constraint e chiavi composte devono riflettere il contesto, ad esempio una membership unica per account-organizzazione o una versione unica per template. Check constraint per intervalli, stati compatibili e valori non negativi quando il vincolo è locale alla riga.

## Dati, ricerca e derivati

Normalizzare relazioni e dati modificabili. Denormalizzare soltanto con una motivazione misurabile e una strategia di aggiornamento. Dati derivati, contatori e viste non sono fonte di verità. La cifratura applicativa di campi selettivi riduce l’esposizione ma impedisce o limita ricerca, sort, unique e indici; va decisa campo per campo, non “cifrando tutto” automaticamente.

## Migrazioni, seed e transazioni

- lo schema deve poter essere ricreato da zero in ordine deterministico;
- una migration già applicata non si modifica: ogni cambiamento strutturale richiede una nuova migration;
- migrazioni distruttive devono prevedere compatibilità, backup e piano di rollback/roll-forward;
- seed solo con dati sintetici, idempotenti e non sensibili;
- transazioni per operazioni multi-tabella che devono essere atomiche;
- concorrenza gestita con unique/check constraint, lock o versionamento quando più richieste possono aggiornare la stessa risorsa;
- modifiche manuali in produzione vietate, salvo procedura d’emergenza documentata, approvata e poi codificata in migration.

Le migration presenti includono il baseline/backend di transizione e le migration account-first `20260811000100_account_first_onboarding.sql`, `20260811000200_onboarding_request_context.sql`, `20260811000300_backend_identity_grants.sql` e `20260811000400_backend_identity_profile_reads.sql`. Il seed è ripetibile e configura tipi organizzativi, ruoli e permission iniziali; non contiene account reali. La suite SQL in `apps/backend/supabase/tests/authorization.sql` verifica l’isolamento tra due organizzazioni per la lettura di profili, organizzazioni e membership, oltre all’assenza di privilegi diretti di mutazione per il ruolo `authenticated`. Il test va eseguito su Supabase locale prima del merge/deploy.

Stato da tenere esplicito: il reset locale ha evidenziato cinque tabelle operative legacy con RLS non attiva (`contract_reminders`, `contract_signatures`, `deferred_document_uploads`, `ppl_invites`, `user_consents`). Non abilitarla alla cieca: prima servono policy, test positivi/negativi e verifica dei consumer. Fino ad allora queste superfici non sono considerate pronte per dati reali.

## Cancellazione, conservazione e audit

Soft delete (`deleted_at`) soltanto dove serve a conservazione, recupero o audit; non usarlo per ogni tabella né per nascondere violazioni di ownership. Definire per classe di dato retention, cancellazione, anonimizzazione e legal hold. Un documento firmato e l’evento di audit hanno requisiti diversi da una preferenza UI. L’audit deve essere append-only e minimizzato.

## Storage e dati cifrati

File in bucket privati, con metadata e ownership nel database. URL firmati a durata breve dopo autorizzazione. Cifratura a riposo e in transito è responsabilità della piattaforma/infrastruttura da verificare per ambiente; cifratura applicativa selettiva solo per dati ad alto impatto, con gestione chiavi separata. Non salvare segreti, token grezzi o password applicative.

## Checklist schema

Prima di approvare una migration verificare tenant boundary, foreign key, nullabilità, cascades, indici su query reali, RLS, audit, retention, dati sensibili, compatibilità con seed e possibilità di restore. Non scrivere ancora lo schema SQL completo finché le decisioni `Da confermare` del modello di dominio non sono risolte.
