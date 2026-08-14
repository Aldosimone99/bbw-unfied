# 03 — Database

## Fonte e stato

PostgreSQL tramite Supabase è la fonte dei dati applicativi. Nel monorepo la
fonte operativa è `apps/backend/supabase/`, con `config.toml`, migration, seed e
regressioni SQL RLS. Il database attualmente presente è una base transitoria
derivata da `bbw-transition`: funziona per il codice esistente, ma non è la
baseline definitiva per un progetto nuovo.

La baseline target adotta il modello identity/authorization di `bbwlanding`
(`profiles`, `organizations`, `organization_members`, ruoli e permessi) con
`professional_profiles`, `subjects`, inviti e audit. È attiva nelle migration
`20260812000000`–`20260812000500`. I moduli di dominio legacy non ancora portati
non devono essere considerati compatibili con questo database solo perché il
codice esiste nel repository.

Non aggiungere nuove feature identity o organization alle tabelle legacy. Le
migration legacy restano archiviate e non applicate a un database nuovo. Non
cancellare né riscrivere migration già applicate: ogni evoluzione richiede una
nuova migration numerata.

Il baseline transitorio usa `public.users`, `public.companies` e
`public.company_members` per l’identità applicativa e il contesto organizzativo,
oltre alle tabelle legacy di profili professionali, indirizzi, inviti,
messaggistica, catalogo, consensi e prenotazioni. Le migration account-first
aggiungono a `public.users` `onboarding_status`,
`requested_account_type`, `requested_organization_name` e
`onboarding_completed_at`. Il tipo richiesto descrive l’intenzione dell’account
e non concede un ruolo o una permission. L’organizzazione attiva non è una
colonna di autorizzazione: il backend ricostruisce il contesto da membership e
stato organizzazione.

La funzione `complete_account_onboarding(...)` è una RPC `SECURITY DEFINER`
eseguibile soltanto dal `service_role` del backend. Per il tipo organization
crea organizzazione e membership owner in modo atomico; per gli altri tipi
completa il profilo senza promuovere automaticamente `tipo_utente`.

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

Le migration `20260811000100`–`20260811000600` sono archiviate come storico del
runtime transitorio e non vanno modificate. La baseline attiva è composta da
`20260812000000_foundation_identity_authorization.sql`,
`20260812000100_account_onboarding_rpc.sql` e
`20260812000200_account_consents.sql`, con hardening RLS in
`20260812000300_rls_policy_hardening.sql` e
`20260812000400_canonical_invitations.sql`. L'accettazione atomica degli inviti
è in `20260812000500_accept_invitation_transaction.sql`. Il seed è ripetibile e non contiene
account reali.

Le migration si applicano dalla directory backend con `npx supabase migration up --local`. Il reset riproducibile e distruttivo del solo database locale è `npx supabase db reset --local`; non va usato come procedura remota.

Stato da tenere esplicito: il reset locale ha evidenziato cinque tabelle operative legacy con RLS non attiva (`contract_reminders`, `contract_signatures`, `deferred_document_uploads`, `ppl_invites`, `user_consents`). Non abilitarla alla cieca: prima servono policy, test positivi/negativi e verifica dei consumer. Fino ad allora queste superfici non sono considerate pronte per dati reali.

## Cancellazione, conservazione e audit

Soft delete (`deleted_at`) soltanto dove serve a conservazione, recupero o audit; non usarlo per ogni tabella né per nascondere violazioni di ownership. Definire per classe di dato retention, cancellazione, anonimizzazione e legal hold. Un documento firmato e l’evento di audit hanno requisiti diversi da una preferenza UI. L’audit deve essere append-only e minimizzato.

## Storage e dati cifrati

File in bucket privati, con metadata e ownership nel database. URL firmati a durata breve dopo autorizzazione. Cifratura a riposo e in transito è responsabilità della piattaforma/infrastruttura da verificare per ambiente; cifratura applicativa selettiva solo per dati ad alto impatto, con gestione chiavi separata. Non salvare segreti, token grezzi o password applicative.

## Checklist schema

Prima di approvare una migration verificare tenant boundary, foreign key, nullabilità, cascades, indici su query reali, RLS, audit, retention, dati sensibili, compatibilità con seed e possibilità di restore. Non scrivere ancora lo schema SQL completo finché le decisioni `Da confermare` del modello di dominio non sono risolte.


## DOMAIN DECISION STATUS — Domain Alignment Pass

**APPROVED**: Subject/Patient globale con relationship scoped; migration additive; soft removal con audit; TreatmentDefinition/TreatmentOffering separati; price e duration operativi sull’offering/context; audit immutabile.

**TBD**: periodo di retention e purge definitivo; lifecycle completo del Patient globale; tassonomia delle qualifiche; schema definitivo appointment/availability/booking policy.

**TECHNICAL DECISION**: le migration `migrations-legacy` non sono baseline e non vengono corrette per questo pass. Le future tabelle appointment/availability saranno canoniche e dovranno includere tenant boundary, association tables, snapshot, exceptions e locking cross-context. Nessuna migration remota viene eseguita.
