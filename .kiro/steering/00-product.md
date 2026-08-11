# 00 — Prodotto BBW

## Stato del documento

Questo file descrive il prodotto da progettare e distingue il nucleo già implementato dalle funzionalità ancora proposte. Nel repository attuale sono presenti la landing marketing, flussi iniziali di autenticazione/onboarding, un callback Supabase, membership multi-organizzazione, risoluzione server-side del contesto attivo, Context Switcher, controllo autorizzativo della dashboard, migration PostgreSQL/RLS, seed e test automatici. Non esiste ancora un MVP di prodotto completo e approvato.

Le etichette usate qui sono:

- **Certo**: vincolo o informazione esplicitamente fornita nel brief o osservabile nel repository.
- **MVP proposto**: candidato alla prima release, da approvare prima dell’implementazione.
- **Post-MVP**: idea successiva, non necessaria per validare il nucleo del prodotto.
- **Da confermare**: decisione di prodotto, legale o operativa ancora aperta.

## Descrizione

Beauty Broker World (BBW) è una piattaforma digitale italiana per gestire relazioni e percorsi nell’ecosistema beauty, medicina estetica, chirurgia plastica, longevità e benessere. Il sistema dovrà collegare persone, organizzazioni, strutture, professionisti e servizi, mantenendo separati identità, profili, organizzazioni, appartenenze e autorizzazioni.

BBW non deve essere descritto come un semplice marketplace: il valore previsto è la continuità del percorso, la scelta consapevole, la fiducia nel network e la gestione sicura delle relazioni. La landing comunica anche “specialisti verificati” e un network editoriale; questi messaggi non sono da soli requisiti funzionali validati.

## Stato implementativo osservato

È già presente una fondazione tecnica, non ancora il prodotto completo:

- registrazione account-first e accesso email/password tramite Server Actions, backend Express di transizione, validazione Zod e messaggi di errore controllati;
- registrazione iniziale ridotta a email, password, conferma password e consensi; il tipo di account non viene richiesto prima del primo login;
- in locale la conferma email è temporaneamente disabilitata per il bootstrap; la verifica email resta un requisito da reinserire prima di staging/production;
- callback Auth, refresh della sessione tramite `src/proxy.ts` e redirect post-login con allowlist;
- profilo minimo creato al nuovo account, onboarding con tipi richiesti `personal`, `healthcare_professional`, `beauty_professional`, `organization` e `commercial`;
- schema iniziale per profili, organizzazioni, membership, ruoli e permission, con RLS, seed e test SQL;
- membership service con organizzazioni accessibili, ruoli contestuali e tipo organizzazione;
- calcolo server-side del contesto attivo tramite cookie HttpOnly validato contro membership e stato dell’organizzazione;
- Context Switcher con Server Action, revalidation e redirect dopo il cambio;
- calcolo separato di permessi globali/platform e permessi della sola organizzazione attiva;
- guardia server-side della dashboard e helper per membership/permission scoped;
- test unitari Vitest per validazione, auth service, redirect, contesto, permission e selezione organizzazione.

La dashboard attuale dimostra il controllo di accesso e mostra profilo, organizzazione attiva, membership, ruoli e permission; non è ancora una dashboard operativa per appuntamenti, consensi o trattamenti. `/admin` non è ancora una route applicativa completa; `/select-context` non è più usata perché il contesto viene risolto server-side e cambiato dal Context Switcher.

## Problema

Le persone possono avere difficoltà a orientarsi tra professionisti, strutture, servizi, appuntamenti e documenti. Organizzazioni e professionisti possono avere bisogno di un contesto condiviso per gestire relazioni, disponibilità, consensi e comunicazioni senza mescolare dati appartenenti a soggetti diversi.

Il prodotto deve ridurre soprattutto:

- ambiguità su chi può vedere o modificare una risorsa;
- frammentazione di informazioni e documenti del percorso;
- passaggi manuali non tracciati;
- dipendenza da autorizzazioni implicite nel client;
- confusione tra ruolo commerciale, ruolo organizzativo e accesso effettivo.

## Utenti e soggetti coinvolti

- **Account**: identità tecnica autenticata.
- **Persona/paziente**: soggetto che segue o richiede un percorso; la definizione operativa di “paziente” è da confermare.
- **Professionista**: persona con un profilo professionale e, eventualmente, appartenenze a più organizzazioni.
- **Organizzazione/struttura**: soggetto collettivo che possiede risorse, servizi o relazioni.
- **Membro di organizzazione**: persona con una membership e assegnazioni contestuali.
- **Operatore BBW**: supporto o amministrazione interna con accesso limitato e motivato.
- **Terze parti**: provider di posta, pagamento, assicurazione o altri servizi eventualmente integrati; nessuna integrazione è da considerare approvata senza decisione separata.

## Obiettivi

1. Rendere esplicito il contesto in cui ogni utente agisce.
2. Consentire relazioni e percorsi verificabili tra persone, professionisti, organizzazioni e servizi.
3. Proteggere dati personali e categorie particolari con autorizzazioni server-side e database.
4. Rendere le operazioni sensibili tracciabili e riproducibili.
5. Conservare il linguaggio e la fiducia del brand, mantenendo l’area operativa leggibile e veloce.

## MVP proposto — da approvare

Il seguente perimetro è una proposta prudente, non una dichiarazione di funzionalità esistente:

- registrazione account, verifica email, accesso, logout e recupero password;
- profilo personale separato dall’identità Supabase Auth;
- onboarding guidato e scelta di un contesto operativo;
- creazione o invito in un’organizzazione, membership e assegnazione di permessi;
- profilo professionale, se la persona è autorizzata a dichiararlo;
- relazione tra persona/paziente e professionista o organizzazione, con stato e revoca;
- catalogo minimo di servizi/trattamenti, se confermato il modello commerciale;
- appuntamenti con ownership, partecipanti, stato e controllo di conflitti;
- template di consenso, documento generato e firma con prova dell’azione;
- allegati in bucket privati e notifiche essenziali;
- audit delle operazioni sensibili;
- dashboard contestuale, senza promuovere il super-admin a lettore automatico di dati sanitari.

## Post-MVP

Da valutare solo dopo aver validato il nucleo e i requisiti legali: pagamenti e rateizzazione, integrazioni assicurative, calendario esterno, notifiche SMS/WhatsApp, video-consulto, reporting avanzato, ricerca professionale pubblica, automazioni, API per partner, multi-lingua e funzioni per reti/franchising.

## Non-obiettivi iniziali

- fornire diagnosi, prescrizioni o consulenza medica automatizzata;
- sostituire cartelle cliniche o sistemi gestionali sanitari completi;
- distribuire direttamente prodotti assicurativi o assumere il ruolo di intermediario;
- mantenere una seconda fonte di verità identity/authorization dal progetto precedente;
- affidare la sicurezza alla sola UI o a un ruolo nominale;
- rendere tutti i dati ricercabili a costo di indebolire privacy e separazione dei tenant.

## Terminologia di dominio

Usare **account**, **profile/profilo**, **organization/organizzazione**, **membership/appartenenza**, **role/ruolo**, **permission/permesso**, **subject/soggetto**, **resource/risorsa**, **relationship/relazione**, **service/servizio**, **appointment/appuntamento**, **consent/consenso**, **signature/firma**, **attachment/allegato** e **audit event/evento di audit**.

Evitare di usare “utente” come sinonimo di persona, membership o ruolo. Evitare “clinica” come chiave di autorizzazione: può essere un tipo o un’etichetta di organizzazione, non un permesso.

## Requisiti certi e decisioni da confermare

**Certo**: sicurezza e privacy by design, minimo privilegio, separazione UI/logica, autorizzazione server e database, audit delle operazioni sensibili, migrazioni riproducibili, test automatici e niente logica critica solo client-side.

**Da confermare**: soggetti obbligatori dell’MVP; significato legale di firma; dati sanitari effettivamente trattati; titolare/responsabile e basi giuridiche; paesi e lingue; processo di verifica professionisti; modello di appuntamento; chi crea servizi e template; retention; canali di notifica; pagamenti/assicurazioni; procedura di accesso supporto; requisiti MFA; uso del termine “paziente”.

## Criteri di priorità

Una richiesta sale di priorità se riduce un rischio privacy/sicurezza, sblocca il percorso principale di un utente, evita dati incoerenti o manualità non tracciata, oppure è necessaria per un vincolo legale/operativo. Le funzionalità estetiche, le integrazioni e le automazioni vengono dopo la validazione del dominio e dell’autorizzazione.
