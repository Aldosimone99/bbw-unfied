# 06 — Standard di codice

## TypeScript e confini

`strict` è obbligatorio. `any` è vietato salvo boundary tecnico documentato, ristretto e coperto da test; preferire `unknown` e narrowing. Validare input esterni con Zod prima di usarli. Separare tipi di dominio, DTO/API e tipi del provider: non esporre direttamente righe Supabase alla UI.

Usare funzioni pure per trasformazioni e calcoli; isolare I/O, clock, random e provider per renderli testabili. Una funzione o componente va estratto quando accumula responsabilità, condizioni di autorizzazione, effetti, duplicazione o accoppiamento che rendono il test poco chiaro; non usare limiti arbitrari di righe.

## Naming

- componenti React e tipi: `PascalCase`;
- funzioni, variabili e hook: `camelCase`; hook con prefisso `use`;
- costanti: `camelCase` per dati locali, `SCREAMING_SNAKE_CASE` solo per costanti davvero globali;
- file componente: `PascalCase.tsx`; CSS Module coerente al componente;
- route App Router: convenzioni Next (`page.tsx`, `layout.tsx`, `route.ts`);
- database: `snake_case`; permission: namespace con punto, ad esempio `organization.members.manage`;
- UUID come tipo/identificativo, non come “role” o stringa semantica senza validazione.

## Import e componenti

Import puliti e raggruppati per esterno, alias/progetto, relativo; evitare cicli. Server Components sono il default. Aggiungere `use client` solo dove servono browser API, eventi o stato interattivo. Un Client Component non importa segreti, repository o service server.

I componenti presentano dati, stati loading/errore/vuoto e accessibilità. Casi d’uso, permission, query, transazioni e side effect di business appartengono allo strato server. Gli hook coordinano stato/effetti UI, non sostituiscono i servizi.

## Stati ed error handling

Modellare esplicitamente loading, success, empty, validation error, unauthorized e server error. Non usare `catch {}` silenziosi. Errori interni vanno loggati in forma redatta con correlation id; alla UI passare un codice e un messaggio utile. Non rivelare l’esistenza di account o risorse quando la policy richiede risposta indistinta.

## DTO, Zod e dominio

Ogni action/handler definisce input schema Zod e DTO di risposta. Il domain model non deve dipendere da React o da Supabase. Le invarianti devono essere espresse nel service e, quando strutturali, nel database. Tipi condivisi vanno in `src/types` solo se sono veramente cross-feature; non creare un “god type”.

## Date, denaro e dominio

Persistenza in UTC (`timestamptz`), timezone dell’organizzazione/utente esplicita e conversione solo in presentazione. Non usare `new Date()` sparso nei casi d’uso senza poter iniettare un clock nei test. Denaro in minor units integer con valuta esplicita, mai float; arrotondamenti e IVA sono **Da confermare**. Preferire branded/validated IDs se confondere due UUID crea rischio.

Evitare enum TypeScript per valori configurabili o che arrivano dal database; usare costanti di dominio, schema e cataloghi. Non duplicare le stringhe delle permission in UI e server: il server è autoritativo e il contratto condiviso deve avere una sola fonte.

## Commenti, documentazione e qualità

Commentare il perché di una regola non ovvia, soprattutto privacy, transazioni e workaround. Non commentare codice morto per tenerlo in vita. Aggiornare Steering, README o contratto API quando cambia il comportamento osservabile. Duplicazione, codice morto, dipendenze inutilizzate e cast non motivati sono segnali per review.

## Accessibilità e futuro i18n

HTML semantico, label associate, focus visibile, tastiera e testo alternativo. Non costruire copy essenziale concatenando stringhe in modo incompatibile con traduzione futura. Le date, numeri, valute, fusi e messaggi devono poter essere localizzati; lingua iniziale italiana, supporto multi-lingua **Da confermare**.
