# BBW Internal Page Pattern

Questo è il template ufficiale per le nuove pagine interne dell'applicazione. Prima di implementare una route, consultare `08-ui.md`, `13-app-design-system.md` e questo documento; una pagina non deve essere progettata isolatamente.

## 1. Page context

La route deve rendere esplicito il contesto autorizzato attraverso il server e ricevere dati già verificati. In un'organizzazione il contenuto è organization-centric: membership, ruoli, nomi tecnici, UUID e permission interne non sono copy da mostrare. Il tipo di organizzazione non è una prova di autorizzazione e non va hardcodato nella UI.

## 2. Page header

Usare il page shell condiviso della dashboard:

- eyebrow `Area organizzativa` quando la pagina lavora dentro una struttura;
- titolo breve e orientato al compito;
- descrizione user-facing di una riga o due;
- content width e padding della dashboard, senza full-width arbitrari.

## 3. Primary action

La primary action deve essere vicina al contenuto che avvia e deve derivare da una capability reale. Se l'utente non può eseguirla, non mostrare una CTA che fallirà soltanto dopo il click. Le mutazioni restano server-side; la UI può rendere l'azione disponibile, mai concederla.

## 4. Main content

Usare section header, liste e card leggere coerenti con la dashboard. Evitare tabelle CRUD dense quando una riga strutturata comunica meglio l'identità, lo stato e il contesto. Usare Lucide tramite `PlatformIcon`, non icone Unicode o SVG locali.

## 5. Secondary content

Cronologie, dettagli secondari e azioni di pulizia devono essere visivamente subordinati al contenuto principale. Separare concettualmente Membri, Staff e Inviti: Membri rappresenta le membership restituite dal dominio; Inviti rappresenta richieste ancora aperte o concluse; Staff resta un sottoinsieme operativo soltanto se il dominio lo definisce esplicitamente.

## 6. Empty/loading/error states

Ogni contenuto deve avere uno stato vuoto progettato con icona, messaggio comprensibile e spiegazione breve; una CTA compare solo se è il passo successivo autorizzato. Il loading preferisce skeleton proporzionati al layout finale, l'errore usa un messaggio leggibile e retry quando sicuro, e gli errori di permission non devono essere trasformati in liste vuote.

## Collection Page

Usata per membri, clienti, consensi, trattamenti, staff e prenotazioni quando il dominio è approvato.

```text
PageHeader
Toolbar (ricerca/filtri/primary action solo se reali)
List rows
Pagination o load more se necessario
Empty/loading/error state
```

La riga deve privilegiare identità, informazione secondaria, metadati contestuali, stato e azioni. Non aggiungere colonne solo per riempire lo spazio.

## Action + History Page

Usata per inviti, richieste e operazioni amministrative con una fase aperta e una cronologia.

```text
PageHeader
ActionCard
PendingSection
HistorySection
Empty/loading/error state
```

La history non deve competere con l'azione primaria; pulizia e rimozione dalla cronologia sono azioni secondarie e confermate quando hanno impatto.

## Detail Page

```text
PageHeader
Primary information
Secondary information
Actions autorizzate
Activity / History
Empty/loading/error state quando applicabile
```

Mostrare soltanto dati necessari al compito e non identificativi tecnici o permission interne.
