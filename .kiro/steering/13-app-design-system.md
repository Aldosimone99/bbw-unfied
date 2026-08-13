# 13 — Design system dell'app

## Scopo e autorità

Questo documento è la fonte di verità per le decisioni grafiche delle superfici applicative Beauty Broker World: dashboard, navigazione, quick actions, card, tabelle, form, modali, dropdown, notifiche e stati di sistema.

La landing marketing può mantenere il proprio linguaggio editoriale, ma ogni nuova superficie operativa deve seguire queste regole. Quando una decisione grafica non è descritta qui, si riusano i token e i pattern già presenti in `08-ui.md`; non si introduce una variante locale senza una decisione esplicita.

Obiettivo: un'interfaccia premium, calma, leggibile e coerente, in cui colori, tipografia, spaziature, motion e icone sembrino appartenere a un unico prodotto.

## Principi visuali

- Privilegiare chiarezza, gerarchia e riconoscibilità rispetto alla decorazione.
- Usare un linguaggio leggero, outline, moderno ed elegante; evitare effetti pieni o ornamentali.
- Mantenere il brand BBW: avorio, polvere, beige, marrone/caffè, oro/champagne e ombre calde leggere.
- Riusare i token esistenti in `globals.css`; non creare una palette parallela con valori quasi identici.
- Mantenere la tipografia esistente: `Avenir Next`, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif.
- Non modificare layout, griglie, spacing o densità di una superficie per introdurre un elemento decorativo.
- Ogni elemento interattivo deve avere stati base, hover, focus-visible, active/selected, disabled e feedback coerenti con il contesto.

## Palette applicativa

Le nuove superfici devono riusare le variabili correnti. I riferimenti principali osservati sono:

| Uso | Token/valore di riferimento |
| --- | --- |
| Fondo chiaro | `--ivory`, `--powder`, circa `#F7F3EE` |
| Testo principale | `--brown`, circa `#2F2824` |
| Oro brand | `--gold`, `#C8A25A` |
| Icona in contenitore | `#B38845` |
| Fondo contenitore icona | `rgba(200, 162, 90, 0.08)` |
| Bordo contenitore icona | `rgba(200, 162, 90, 0.12)` |

Il colore da solo non deve essere l'unico modo per comunicare stato, errore, permesso o completamento: usare anche testo, icona, struttura o feedback accessibile.

## Tipografia e allineamento

- Non introdurre font, pesi o scale locali senza necessità documentata.
- Le icone sono parte della tipografia: devono condividere asse verticale, baseline percepita e colore con il testo adiacente.
- Usare `display: block` sulle icone SVG in flex/grid per evitare disallineamenti da baseline inline.
- Usare `align-items: center` nei contenitori con testo e icona; definire il `gap` nel componente, non con margini casuali sull'icona.
- Il testo resta sempre presente quando l'icona non è universalmente riconoscibile o quando l'azione è sensibile.

## Icone: libreria e stile obbligatori

L'applicazione usa esclusivamente **Lucide React** (`lucide-react`). Non introdurre Heroicons, Tabler, Phosphor, Remix, Feather, icone Unicode, SVG inline disegnati a mano o forme CSS per rappresentare funzioni dell'app.

Regole obbligatorie:

- usare sempre la mappa ufficiale riportata sotto;
- usare la stessa icona per la stessa funzione in sidebar, header, quick actions, card, dropdown, modali, tabelle e messaggi;
- preferire icone outline, senza fill, con percezione leggera e moderna;
- `strokeWidth={1.75}`;
- `strokeLinecap="round"` e `strokeLinejoin="round"`;
- usare `fill="none"`/il comportamento di default Lucide;
- non applicare rotazioni, scale arbitrarie, bordi CSS o pseudo-elementi per trasformare un'icona;
- non sostituire un'icona solo per gusto locale o per una singola pagina;
- usare `aria-hidden="true"` quando l'icona è decorativa e fornire sempre un nome accessibile all'azione tramite testo, `aria-label` o label associata.

### Regola fissa Safari per le SVG Lucide

Ogni superficie applicativa che renderizza icone Lucide deve applicare un reset CSS base alle SVG, scoped al relativo shell/app container. Questa regola è obbligatoria per evitare che Safari riutilizzi o interpreti vecchie regole di bordi, radius o background sui nodi SVG.

Il reset deve essere equivalente a:

```css
.appShell :global(svg.lucide) {
  display: block;
  box-sizing: border-box;
  flex: 0 0 auto;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  overflow: visible;
  vertical-align: middle;
  -webkit-appearance: none;
  appearance: none;
}
```

Regole correlate:

- bordi, radius e background appartengono solo al contenitore dell'icona, mai alla SVG;
- non usare `::before` o `::after` per disegnare o decorare un'icona Lucide;
- non applicare `transform`, scale o rotate all'icona per correggere un problema di peso o allineamento;
- non creare reset diversi per browser diversi: il reset Safari-safe è la base comune dell'app;
- quando si crea un nuovo app shell, riusare questa regola prima di aggiungere stili locali alle icone;
- verificare sempre che il CSS compilato contenga il selettore `svg.lucide` e che Safari non mostri contorni duplicati.

### Dimensioni ufficiali

| Superficie | Dimensione |
| --- | ---: |
| Sidebar desktop/mobile | 18px |
| Header/navbar | 18px |
| Quick Actions | 18px |
| Card | 20px |
| Controlli inline densi | 18px, salvo eccezione documentata |

Le dimensioni devono essere definite dal componente condiviso o dal contratto della superficie. Non usare numeri casuali per compensare un'icona scelta male.

### Contenitore delle icone nelle card

Quando una card ha un'icona principale, usare un contenitore circolare discreto:

- diametro: circa 48px;
- icona: 20px;
- background: `rgba(200, 162, 90, 0.08)`;
- border: `1px solid rgba(200, 162, 90, 0.12)`;
- colore icona: `#B38845`;
- nessun riempimento sull'icona;
- nessun badge, rombo, indicatore decorativo o pseudo-elemento aggiuntivo.

Il contenitore non deve diventare il punto focale della card. Deve sostenere la gerarchia del contenuto e restare coerente tra card di profilo, calendario, prenotazioni e future card applicative.

## Componente condiviso e implementazione

La mappa delle icone deve avere una sola implementazione tipizzata e riusabile. I componenti feature non devono importare e configurare singolarmente icone equivalenti con stroke, size o colori diversi.

Nel repository attuale il mapping è implementato in `src/features/dashboard/PlatformIcon.tsx`. Se l'uso cresce oltre la dashboard, spostare l'adapter in `src/components/ui/` mantenendo una sola fonte e senza duplicare la mappa.

L'adapter condiviso deve permettere almeno:

- nome semantico della funzione;
- dimensione prevista dalla superficie;
- `className` per colore e layout;
- stroke uniforme già impostato a `1.75`;
- cap e join round già impostati;
- comportamento accessibile coerente.

## Stato, hover e motion

- Stato attivo: mantenere il contenitore/pill previsto dal componente; l'icona comunica lo stato con il colore oro `#C8A25A`.
- Hover: cambiamento discreto di colore e/o background, senza movimenti o scale invasive.
- Durata standard: `180–220ms`, preferibilmente `200ms`, con `ease-out`.
- Focus: sempre visibile con `:focus-visible`, senza rimuovere il contorno per mouse o touch.
- Active/pressed: non aggiungere indicatori decorativi non richiesti.
- Rispettare `prefers-reduced-motion`; disabilitare trasformazioni e transizioni non essenziali quando richiesto.

## Componenti e superfici

### Sidebar e header

- Usare icone da 18px, stesso stroke e proporzione delle card.
- L'icona deve stare sullo stesso asse del testo e avere un'area cliccabile adeguata all'intero link o controllo.
- L'icona attiva può diventare oro, ma non deve introdurre cerchi, rombi o indicatori separati.
- Dropdown e controlli di apertura usano icone Lucide coerenti, ad esempio `ChevronDown`, mai caratteri Unicode decorativi.

### Quick Actions

- Usare esattamente la stessa icona della card o della destinazione funzionale.
- Dimensione standard 18px.
- Non creare una variante “più dinamica” o “più piena” per le quick actions.
- Le frecce di affordance sono icone Lucide e non caratteri tipografici isolati.

### Card

- Ogni card deve avere un'icona coerente con il proprio contenuto; non usare la stessa icona per tutte le card.
- Profilo usa `UserRound`, Calendario usa `CalendarDays`, Prenotazioni usa `ClipboardList`.
- Dimensione standard 20px nel contenitore circolare da circa 48px.
- L'icona rafforza il riconoscimento della sezione, ma non sostituisce titolo e testo.

### Tabelle, form, modali e stati

- Azioni con la stessa funzione usano la stessa icona della mappa ufficiale.
- Azioni distruttive richiedono testo esplicito, conferma e feedback; `Trash2` da sola non è sufficiente.
- Errori, attenzione, successo e caricamento devono usare icona, testo e stato accessibile; non affidarsi solo al colore.
- Gli stati di caricamento devono rispettare reduced motion e non usare animazioni continue non necessarie.

## Mappa ufficiale delle icone

Questa è la mappa normativa. La colonna “Motivazione” spiega la scelta semantica e aiuta a evitare sostituzioni arbitrarie.

| Funzione | Icona Lucide | Motivazione |
| --- | --- | --- |
| Home | `House` | Rappresenta il punto di ingresso principale e lo spazio personale. |
| Profilo | `UserRound` | Identifica una persona e i dati del profilo individuale. |
| Calendario | `CalendarDays` | Rappresenta la vista e l'organizzazione delle date. |
| Prenotazioni | `ClipboardList` | Comunica un elenco strutturato di richieste o prenotazioni. |
| Appuntamenti | `CalendarClock` | Unisce evento in calendario e informazione temporale. |
| Trattamenti | `ClipboardPlus` | Rappresenta una prestazione o voce da aggiungere a un percorso. |
| Documenti | `FileText` | Identifica un documento testuale o amministrativo. |
| Consensi | `FileSignature` | Comunica un documento che richiede firma o consenso. |
| Pazienti | `UsersRound` | Rappresenta un insieme di persone assistite. |
| Professionisti | `Stethoscope` | Identifica il contesto professionale sanitario/clinico. |
| Cliniche | `Building2` | Rappresenta una struttura o organizzazione fisica. |
| Dashboard | `LayoutDashboard` | Identifica una superficie composta da widget e riepiloghi. |
| Pagamenti | `CreditCard` | Rappresenta un pagamento o uno strumento di pagamento. |
| Fatture | `Receipt` | Identifica una ricevuta o fattura emessa. |
| Notifiche | `Bell` | Rappresenta avvisi e aggiornamenti da leggere. |
| Messaggi | `MessageSquare` | Identifica conversazioni e comunicazioni testuali. |
| Ricerca | `Search` | Affordance standard per cercare contenuti. |
| Altre azioni | `MoreHorizontal` | Apre il menu delle azioni secondarie contestuali. |
| Filtri | `SlidersHorizontal` | Rappresenta criteri regolabili per restringere un elenco. |
| Impostazioni | `Settings2` | Rappresenta preferenze e configurazione dell'app. |
| Ruoli | `ShieldCheck` | Comunica responsabilità e ruolo verificato. |
| Permessi | `KeyRound` | Rappresenta una capacità di accesso o autorizzazione. |
| Privacy | `Lock` | Identifica protezione e controllo sui dati personali. |
| Sicurezza | `Shield` | Rappresenta la protezione generale del sistema. |
| Storico | `History` | Identifica una sequenza di attività o eventi passati. |
| Statistiche | `ChartColumn` | Rappresenta dati aggregati e andamento quantitativo. |
| Report | `FileBarChart` | Unisce documento e rappresentazione di dati. |
| Esporta | `Download` | Comunica l'uscita di dati dal sistema verso il dispositivo. |
| Importa | `Upload` | Comunica l'ingresso di dati nel sistema dal dispositivo. |
| Elimina | `Trash2` | Affordance riconoscibile per rimozione o cancellazione. |
| Modifica | `Pencil` | Rappresenta l'aggiornamento di un contenuto esistente. |
| Aggiungi | `Plus` | Affordance per creare o aggiungere un elemento. |
| Conferma | `Check` | Rappresenta il completamento o la conferma di un'azione. |
| Annulla | `X` | Rappresenta annullamento, chiusura o rimozione di una scelta. |
| Informazioni | `CircleHelp` | Fornisce contesto o spiegazione aggiuntiva senza allarme. |
| Attenzione | `TriangleAlert` | Comunica un rischio o una situazione che richiede attenzione. |
| Successo | `BadgeCheck` | Rappresenta un esito positivo o una verifica completata. |
| Errore | `CircleX` | Comunica un errore o un'operazione non riuscita. |
| Caricamento | `LoaderCircle` | Indica un'attesa o un processo in corso. |

## Regole per nuove funzioni

Prima di aggiungere una nuova icona:

1. verificare se la funzione esiste già nella mappa;
2. riusare l'icona già assegnata se il significato è lo stesso;
3. verificare che il componente non stia usando una libreria diversa o un SVG locale;
4. scegliere un'icona Lucide semantica, outline e leggibile alla dimensione prevista;
5. aggiungere la nuova funzione a questa tabella con motivazione;
6. aggiornare l'adapter condiviso e i test/controlli UI necessari;
7. verificare desktop, mobile, tastiera, focus-visible e reduced motion.

Non aggiungere alias concorrenti. Se una funzione è ambigua, fermarsi e marcare la decisione come **Da confermare** prima di introdurre una nuova icona.

## Definition of done visuale

Una modifica grafica è completa quando:

- non introduce una seconda libreria iconografica;
- usa la mappa ufficiale o aggiorna esplicitamente questa mappa;
- mantiene dimensioni, stroke, cap e join previsti;
- non modifica layout o spacing senza requisito separato;
- mantiene contrasto, focus-visible e semantica accessibile;
- verifica hover, active, disabled, loading, error e reduced motion quando applicabili;
- passa typecheck, test e build previsti dal repository;
- non lascia SVG inline, pseudo-icone o caratteri Unicode per la stessa funzione.

## Convenzioni per liste e azioni contestuali

Nelle liste applicative l'affordance per un gruppo di azioni usa `MoreHorizontal`, resa dal mapping `moreActions` dell'adapter `PlatformIcon`; non usare caratteri Unicode come `•••`. La ricerca usa `Search` tramite il mapping `search`. Le due icone mantengono `18px`, `strokeWidth={1.75}`, cap e join round e devono avere un nome accessibile sul controllo che le contiene.

Le superfici organizzative Inviti e Staff costituiscono il riferimento per righe premium: identità primaria, informazione secondaria, metadati contestuali, badge semantico e menu solo per azioni effettivamente autorizzate. Staff è la superficie user-facing delle membership e delle persone che collaborano con la struttura; non mantenere una pagina Membri separata.

## Workspace e metadata di contesto

I controlli dropdown della dashboard usano `ChevronDown` tramite `PlatformIcon`; `ChevronsUpDown` non va introdotto per comunicare un semplice menu apribile. Il trigger workspace mantiene icona, nome principale, metadata secondari muted e target cliccabile completo.

I badge di ruolo e tipo nelle card sono metadata: devono usare `width: fit-content`, altezza e padding compatti, bordo sottile, fondo beige leggero e testo oro/marrone. Non devono imitare input disabilitati né occupare tutta la larghezza della card.

Il popover workspace riusa il design system delle card e dei dropdown: avorio, border sottile, radius 8–14px, shadow calda morbida, hover beige leggero e stato attivo appena percettibile. Quando la sidebar ha overflow, il popover può essere montato in portal con posizionamento fixed per preservare la larghezza utile e impedire il clipping.