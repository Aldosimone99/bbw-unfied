# 12 — Regole per contributi assistiti da AI

- Analizzare repository, stato Git e istruzioni prima di modificare file.
- Non trattare marketing copy, placeholder o una bozza Steering come requisito approvato.
- Marcare le decisioni ambigue come **Da confermare**; non inventare ruoli, dati sanitari, workflow legali o integrazioni.
- Non implementare autenticazione, database, API o feature quando la richiesta è documentale.
- Non modificare codice esistente, asset, dipendenze o environment senza richiesta esplicita.
- Non leggere, riportare o committare secret reali; non usare `env.local` come documentazione di valori.
- Non creare autorizzazione basata su nomi visibili (`clinic`, `doctor`, `patient`) o soltanto sulla UI.
- Non mettere service role, query sensibili o logica critica in Client Components.
- Non introdurre codice duplicato, any non motivati, dipendenze o file inutili.
- Riutilizzare token, componenti e convenzioni già presenti prima di creare varianti.
- Per modifiche al database, richiedere/registrare una decisione e usare migration nuova; non riscrivere migration applicate.
- Per ogni feature implementata, aggiungere test adeguati e una regressione per bug fix quando possibile.
- Verificare typecheck, lint, test, build e impatto responsive/accessibility in proporzione al rischio.
- Se un requisito confligge con sicurezza/privacy o con istruzioni più specifiche del repository, fermare l’implementazione e rendere esplicito il conflitto.
