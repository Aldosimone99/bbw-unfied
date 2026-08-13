# BBW Lists, Statuses and Empty States

Questo documento completa `08-ui.md` e `13-app-design-system.md` per le superfici applicative. Le regole sono vincolanti per le nuove liste interne.

## List rows

Una riga contiene al massimo:

1. identità primaria;
2. informazione secondaria;
3. metadati contestuali;
4. stato;
5. azioni autorizzate.

Evitare sei o sette colonne quando le stesse informazioni possono essere gerarchizzate. Su mobile la riga si dispone in: avatar + nome, email o informazione secondaria, ruolo/metadati + stato, menu azioni.

Le liste devono usare dati e label restituiti da contratti o mappe presentazionali centralizzate. Non mostrare membership ID, UUID, organization ID, scope, permission check o ruoli tecnici. Non hardcodare ruoli, tipi organizzazione o disponibilità di azioni.

## Status badges

I badge comunicano uno stato anche tramite testo e struttura, mai soltanto tramite colore. Le tonalità semantiche disponibili sono:

- `neutral`: informazione non attiva o conclusa senza esito positivo/negativo;
- `success`: stato attivo o completato positivamente;
- `warning`: attesa o attenzione richiesta;
- `error`: errore, sospensione o stato che richiede intervento;
- `pending`: usare la semantica `warning` per stati in attesa.

Riutilizzare i token BBW e il componente condiviso, senza colori saturi o valori locali non motivati.

## Empty states

Ogni lista deve avere un empty state progettato, composto da:

- icona Lucide coerente;
- messaggio specifico e leggibile;
- spiegazione breve opzionale;
- CTA soltanto quando esiste un passo successivo utile e autorizzato.

Non usare `Nessun dato.` come unico contenuto. Distinguere lista realmente vuota, ricerca senza risultati, accesso negato ed errore di caricamento.

## Loading

Usare skeleton o righe di caricamento proporzionati alla struttura finale della lista. Evitare spinner centrali grandi o animazioni continue non necessarie. Rispettare `prefers-reduced-motion` e comunicare l'attesa con `role="status"` quando il contenuto cambia.

## Error

Mostrare un messaggio user-facing, senza stack trace, codici backend grezzi o dettagli di tenant. Offrire retry quando l'operazione è sicura e disponibile. Un errore di autorizzazione non deve diventare un empty state e una mutazione fallita deve lasciare feedback nell'area interessata.

## Azioni

Le azioni secondarie stanno in un menu `MoreHorizontal` soltanto quando esiste una mutazione o visualizzazione reale. Ogni menu deve avere nome accessibile, focus visibile, tastiera e feedback; azioni distruttive richiedono conferma e spiegazione dell'impatto. La capability viene verificata dal server anche quando il controllo è nascosto o assente.
