# 09 — Definition of Done

Una feature è completata solo quando il comportamento approvato, il confine di sicurezza, l’esperienza e la manutenzione sono verificati insieme. “Funziona nel browser” non è sufficiente. I comandi di verifica disponibili sono `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build`.

## Documentazione

- [ ] Requisito e decisioni sono collegati al brief/issue.
- [ ] Casi ambigui sono marcati **Da confermare**, non trasformati in assunzioni.
- [ ] Modello di dominio, errori, permission e comportamento osservabile sono aggiornati.
- [ ] README, API o runbook sono aggiornati se cambiano setup o operazioni.

## Database e migrazioni

- [ ] Migration nuova e riproducibile; nessuna migration applicata è stata riscritta.
- [ ] Vincoli, foreign key, indici, cascades e ownership sono motivati.
- [ ] RLS è attiva e copre positivi/negativi nei tenant rilevanti.
- [ ] Seed è sintetico/idempotente e il reset da zero funziona.
- [ ] Retention, cancellazione, dati sensibili e audit sono considerati.

## Backend/server

- [ ] Input validato al confine e DTO separati dal provider.
- [ ] Sessione, contesto, ownership e permission verificati lato server.
- [ ] Logica di dominio nel service, non nella UI.
- [ ] Errori classificati, redatti e restituiti con contratto stabile.
- [ ] Operazioni multi-tabella atomiche e integrazioni idempotenti ove necessario.

## Frontend

- [ ] Stati loading, success, empty, validation error, unauthorized e server error gestiti.
- [ ] Nessun secret, service role o dato sensibile nel bundle/client/log.
- [ ] UI coerente con token BBW e con la superficie marketing/auth/app appropriata.
- [ ] Form con label, validazione e feedback; nessuna autorizzazione solo visuale.
- [ ] Verifica manuale su viewport rilevanti e senza overflow inatteso.

## Sicurezza e privacy

- [ ] Nessun accesso basato solo su ID fornito dal client.
- [ ] Bucket privati, upload limitato e URL firmati se applicabile.
- [ ] Rate limit, CSRF/XSS/SSRF e webhook considerati per il caso.
- [ ] Audit delle operazioni sensibili senza payload clinici nei log.
- [ ] Segreti da environment/secret manager e dipendenze revisionate.

## Test

- [ ] Typecheck e lint passano.
- [ ] Unit/integration/database/RLS/component/E2E aggiunti secondo il rischio.
- [ ] Bug fix coperto da regressione quando ragionevolmente possibile.
- [ ] Test esistenti non alterati solo per mascherare una regressione.
- [ ] Migration reset/upgrade, smoke e casi negativi verificati.

## Accessibilità

- [ ] Tastiera, focus visibile, semantica, contrasto e screen reader smoke verificati.
- [ ] Errori annunciati e associati ai campi.
- [ ] Motion riducibile e immagini con alt appropriati.
- [ ] Modali e azioni distruttive gestiscono focus e conferma.

## Osservabilità

- [ ] Correlation/request id dove utile.
- [ ] Metriche e log non contengono secret o dati sensibili.
- [ ] Errori operativi distinguibili da input/non autorizzato.
- [ ] Alert, dashboard o runbook aggiornati se il rischio lo richiede.

## Deployment e review

- [ ] Ambiente target, env, redirect, storage policy e migration plan verificati.
- [ ] Backup/restore e rollback/roll-forward considerati per dati persistenti.
- [ ] Review di codice e sicurezza completate; decisioni aperte approvate.
- [ ] Nessuna modifica manuale non documentata in production.
- [ ] La feature è pronta per il deploy solo dopo evidenza dei check, non per assunzione.
