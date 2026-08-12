# Transition Backend — Module Inventory

Questo inventario serve a portare i moduli di `bbw-transition` sopra la nuova
baseline identity/authorization. La presenza di una route o di un service non
significa che il modulo sia pronto per dati reali.

## Ordine di porting

| Ordine | Modulo | Priorità | Dipendenze principali | Sensibilità |
| ---: | --- | --- | --- | --- |
| 1 | Profilo personale | MVP | Account, Profile | Dati personali |
| 2 | Organizzazioni e inviti | MVP | Organization, Membership, Role | Accesso tenant |
| 3 | Membership e ruoli | MVP | Permission, audit | Sicurezza |
| 4 | Profilo professionale | MVP | Profile, verifica | Dati professionali |
| 5 | Catalogo e servizi | MVP proposta | Organization, ProfessionalProfile | Commerciale |
| 6 | Disponibilità e appuntamenti | MVP proposta | Organization, Service, Subject | Personale/sensibile |
| 7 | Consensi e documenti | MVP proposta | Subject, Organization, Storage | Alto impatto |
| 8 | Messaggistica e notifiche | Successivo | Membership, Relationship | Personale |
| 9 | Contratti e commerciale | Successivo | Organization, Document, Signature | Legale/commerciale |
| 10 | Admin e reportistica | Successivo | Audit, platform permissions | Alto impatto |

## Moduli da non portare automaticamente

| Modulo | Decisione |
| --- | --- |
| OTP/codice email locale | Sostituire con verifica email Supabase prima di staging/production. |
| Referral/PPL | Rivalutare dopo aver definito soggetti, relazioni e modello commerciale. |
| Address provider | Isolare dietro adapter; nessun provider è parte della baseline. |
| Chat legacy | Portare solo dopo aver definito retention, partecipanti e permessi. |
| Contratti legacy | Non esporre finché firma, audit e valore giuridico non sono confermati. |
| Admin globale | Non deve diventare accesso automatico a dati personali o sanitari. |

## Checklist per ogni modulo

Prima del porting verificare:

- [ ] entità e soggetto a cui appartiene ogni record;
- [ ] organizzazione/tenant e percorso di ownership;
- [ ] ruoli e permission necessari;
- [ ] dati personali o categorie particolari coinvolti;
- [ ] stato, transizioni e revoca;
- [ ] foreign key, indici e vincoli;
- [ ] RLS e test positivo/negativo;
- [ ] service backend e repository isolati;
- [ ] contratto Zod condiviso;
- [ ] audit per le mutazioni sensibili;
- [ ] UI con gestione errori e stato vuoto;
- [ ] test unitari, route, SQL ed end-to-end.

## Primo vertical slice

Il primo vertical slice consigliato è:

```text
registrazione
  → login
  → profilo
  → onboarding account-first
  → organizzazione
  → membership owner
  → /auth/context
  → dashboard contestuale
```

Solo quando questo percorso usa la nuova baseline e ha test di isolamento tra
due account/organizzazioni si può iniziare il porting di catalogo e appuntamenti.

## Stato del porting iniziale

- Organizzazioni e inviti usano già `organizations`, `organization_members`,
  `roles`, `member_roles` e `invitations`.
- Il token di invito è memorizzato solo come hash; l'accettazione richiede un
  account autenticato con la stessa email dell'invito.
- I profili professionali usano `professional_profiles` e
  `professional_types`; la verifica è uno stato esplicito e non può essere
  assegnata dalla UI.
- Le vecchie route e i test non ancora portati restano debito di migrazione:
  non devono essere considerati pronti per dati reali solo perché il file
  esiste nel repository.
