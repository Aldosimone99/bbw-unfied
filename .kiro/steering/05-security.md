# 05 — Sicurezza

## Threat model iniziale

Asset principali: identità e sessioni, profili, relazioni, dati sanitari eventualmente trattati, consensi e firme, allegati, membership, audit e segreti d’integrazione. Attori da considerare: account compromesso, utente di altro tenant, membro revocato con sessione aperta, operatore interno curioso, client alterato, bot, webhook falsificato, provider compromesso e dipendenza vulnerabile.

Scenari prioritari: IDOR cambiando UUID; escalation tramite ruolo o organizzazione inviati dal client; accesso a bucket/file; fuga di dati in log/errori; replay di webhook o firma; brute force; upload malevolo; SSRF da URL esterni; RLS mancante o incoerente; migrazione/backup esposto.

## Classificazione

- **Comune**: contenuti marketing e dati non personali pubblici.
- **Personale**: email, nome, contatti, identificativi, membership e metadati di utilizzo.
- **Categoria particolare**: informazioni su salute, trattamenti, anamnesi o documenti che le contengono. La presenza concreta e la base giuridica sono **Da confermare**.
- **Segreto**: chiavi, token, cookie, credenziali provider e materiale crittografico.

Minimizzare raccolta, copie, payload e retention. Non inserire dati di categoria particolare in URL, log, analytics, errori o notifiche non necessarie.

## Cifratura e chiavi

HTTPS/TLS in transito e cifratura a riposo fornita dalla piattaforma devono essere obbligatori in staging/production e verificati nei contratti/configurazioni. La cifratura applicativa selettiva può proteggere campi ad alto impatto, ma rende più difficili ricerca, indici, unique constraint, debug e migrazioni; va valutata per campo e threat model, non applicata a tutto per principio.

Password e token non si cifrano per poi recuperarli: si usa hashing o il provider dedicato. Non implementare algoritmi crittografici propri senza revisione competente. Chiavi in secret manager, mai nel repository; rotazione, revoca e accesso minimo documentati.

## Segreti e confini

- nessun secret nel browser o in codice `NEXT_PUBLIC_*`;
- nessuna `service_role`/secret key nel frontend, nei Client Components o in bundle;
- chiavi pubbliche solo dove previsto dal provider e con RLS attiva;
- environment separati per local, development, staging e production;
- non stampare valori di env, cookie o token nei log.

Nel repository il codice e `.env.example` usano `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY` è server-only e non deve essere letto da Client Components o incluso in bundle. Non leggere o committare i valori reali; i file `.env.local`/`env.local` devono restare ignorati.

## Autorizzazione, input e web

Ogni route/action ricostruisce sessione, contesto e permission; nessun accesso è basato solo su UI o ID ricevuto dal client. Login, registrazione e onboarding applicano già Zod ai confini; il service applica le invarianti iniziali e il repository limita il data access. Query parametrizzate/SDK prevengono SQL injection, ma non sostituiscono RLS.

Per XSS: React escaping di default, niente HTML non fidato, sanitizzazione con libreria approvata per eventuale rich text e CSP da valutare. Per CSRF: cookie/session policy, same-origin checks e token/controlli appropriati per mutazioni non protette da un framework; verificare ogni Route Handler. Rate limiting su login, registrazione, reset, inviti, upload, ricerca e endpoint costosi, con risposta che non rivela account esistenti.

SSRF: non fetchare URL forniti dall’utente senza allowlist, parsing sicuro, blocco rete interna, timeout e limiti. Webhook: verifica firma, timestamp/finestra anti-replay, payload schema, idempotency key e stato di elaborazione.

## File e Storage

Bucket privati; path non predicibili o comunque non considerati segreto. Prima di accettare un upload verificare permission, dimensione, estensione dichiarata e MIME sniffato, evitando di fidarsi del solo header. Limiti coerenti tra UI, route e Supabase; nome file normalizzato; nessun file eseguibile servito come HTML. Scansione antivirus/quarantena è raccomandata per allegati condivisibili e **Da confermare** per l’MVP. Download tramite URL firmato breve e autorizzato al momento della richiesta.

## Audit e logging

Audit per accessi elevati, modifica permessi/membership, lettura eccezionale di dati, consensi/firme, download sensibili, eliminazioni, webhook e cambi di configurazione. Evento: attore, contesto, azione, risorsa minimizzata, esito, timestamp, request/correlation id e motivo quando previsto.

Log applicativi redatti: mai password, token, secret, documento, contenuto sanitario o payload completo. Definire retention e accesso ai log; audit non è un sostituto della telemetria e non deve diventare una copia dei dati.

## Backup, incidenti e dipendenze

Backup cifrati, con retention e accesso minimo; restore testato periodicamente in ambiente isolato e con RPO/RTO **Da confermare**. Incident response: rilevare, contenere, preservare evidenze, valutare impatto, notificare secondo obblighi, correggere, fare post-mortem e aggiornare controlli.

Dipendenze fissate nel lockfile, aggiornate con review, audit e changelog; evitare pacchetti inutili. CI deve controllare vulnerabilità e secret scanning senza bloccare indiscriminatamente aggiornamenti urgenti. La supply chain comprende npm, Supabase CLI, immagini e workflow.

## Minimo privilegio

Ruoli tecnici, database, bucket, CI e operatori ricevono soltanto gli scope necessari. Service role solo in processi server strettamente controllati. Le policy RLS e la procedura super-admin devono essere testate e riesaminate quando cambia il modello di dominio.
