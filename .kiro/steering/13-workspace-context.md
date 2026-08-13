# Workspace Context

Beauty Broker World supporta più contesti operativi per lo stesso account. Il modello deve distinguere sempre:

- **account autenticato**: identità della persona che ha effettuato l'accesso;
- **workspace attivo**: contesto operativo nel quale la persona sta lavorando;
- **membership**: appartenenza verificata a un'organizzazione;
- **capabilities**: permission effettive per il workspace attivo.

Il workspace attivo non coincide con l'account autenticato e non è una proprietà affidabile del client.

## Workspace Switcher Pattern

Il workspace switcher è una funzione globale dell'applicazione:

- vive nella navigation globale/sidebar, non dentro una pagina specifica o una card dashboard;
- mostra sempre il workspace attivo con nome, tipo user-facing, ruolo quando disponibile e icona coerente;
- apre un popover custom, non un `<select>` HTML nativo;
- deriva da `availableOperationalContexts` e supporta N workspace senza assumere che esistano solo Studio personale e una clinica;
- usa il riferimento reale `{ kind, id }`, dove l'id è il professional profile per `personal_professional` o l'organizzazione per `organization`;
- mostra il check sul contesto attivo e non espone UUID, membership ID o permission tecniche;
- offre una destinazione di gestione solo quando esiste una route e una capability reale.

Il componente globale è responsabile della presentazione, dell'interazione, del focus, della gestione Escape, del loading e dell'errore. La business logic resta nelle Server Actions e nei service server.

## Navigation Rules

Le voci della sidebar e le superfici raggiungibili dipendono dal workspace attivo e dalle capabilities effettive, non dal solo nome del ruolo o dal tipo visualizzato. Dopo un cambio workspace la destinazione predefinita è la dashboard del nuovo contesto; non si forza il mantenimento di una route che potrebbe non essere disponibile.

La sidebar deve distinguere visivamente:

- **Spazio attivo**: dove la persona sta lavorando;
- **Account**: chi è la persona autenticata.

Lo stesso switcher deve funzionare nella sidebar desktop e mobile, con target touch ampi e senza overflow.

## Security Rules

Il workspace selezionato nel browser non rappresenta autorizzazione. Ogni selezione deve:

1. validare lo schema del riferimento;
2. ricostruire sessione, ownership/professional profile o membership dal server;
3. verificare stato operativo, organizzazione e permission;
4. salvare soltanto una reference minima nel cookie HttpOnly;
5. ricalcolare ruoli e capabilities per le richieste successive;
6. invalidare/revalidare i dati derivati dal contesto precedente.

Se il cambio fallisce, il workspace precedente resta attivo e la UI mostra un errore leggibile. Il client non può scegliere organizzazione, membership, ruolo o permission arbitrari.

## Workspace-aware pages

Le pagine organization-centric devono ricevere e usare il contesto attivo già risolto dal server. Le pagine dello Studio personale devono usare il relativo professional profile. Non mescolare dati, query o capabilities tra workspace diversi e non usare nomi come “Clinica Di Rosa” per decidere il comportamento.

## Refinement visuale e interaction contract

Il pattern globale del workspace comprende:

- trigger compatto con label `Spazio attivo`, nome principale, tipo/ruolo secondario muted e `ChevronDown`;
- popover custom BBW con larghezza desktop sufficiente alla lettura dei nomi, righe interamente cliccabili, check oro soltanto sul workspace attivo e background attivo appena percettibile;
- `Gestisci spazi` visibile solo quando route e capability server-side lo consentono;
- portal/fixed positioning quando il contenitore sidebar potrebbe tagliare il popover;
- Escape, click outside, focus visibile, focus restituito al trigger alla chiusura, frecce/Home/End sulle righe e `aria-expanded`/`aria-controls` sul trigger;
- pending minimale con selezioni disabilitate e messaggio inline, errore leggibile senza sostituire o invalidare il workspace precedente;
- stesso contratto su desktop e mobile, con target touch ampi e nessun `<select>` nativo.

Il blocco Account resta separato dal workspace ma può contenere la propria label dentro il bordo del box. La descrizione secondaria dell'account deve usare il mapping ruolo user-facing centralizzato e non duplicare `Account personale` quando la label è già presente.

Le card `Il tuo studio` e `La tua struttura` sono informative: mostrano tipo, nome, badge ruolo fit-content e stato del profilo/contesto; non contengono controlli di cambio workspace.