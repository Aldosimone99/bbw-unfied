# BBW Unified — Canonical Domain Model

## Decision

Il database applicativo parte da un modello normalizzato in cui l'identità,
la persona, il contesto organizzativo, il ruolo professionale e il soggetto di
un percorso sono entità diverse.

```text
Account (Supabase Auth)
  └── Profile
        ├── ProfessionalProfile → ProfessionalType / Credentials
        ├── Subject             → relazioni di percorso
        └── OrganizationMembership → Role → Permission

Organization → OrganizationType
```

## Attori del dominio

| Concetto | Rappresentazione | Non significa |
| --- | --- | --- |
| Cliente | `Profile` + `Subject` di tipo persona | Non è un ruolo amministrativo |
| Medico/dottore | `ProfessionalProfile` con tipo `physician` o `healthcare_professional` | Non concede accesso clinico automaticamente |
| Estetista | `ProfessionalProfile` con tipo `beauty_professional` | Non è una permission |
| Commercialista | `ProfessionalProfile` con tipo `accountant` e, se necessario, membership in uno studio | Non è il ruolo platform |
| Clinica | `Organization` con tipo `clinic` | Non è una prova di autorizzazione |
| Studio/rete/azienda | `Organization` con tipo configurabile | Non determina da sola i dati accessibili |
| Proprietario/amministratore | `OrganizationMembership` + ruolo contestuale | Non è un tipo di account globale |

Una persona può avere più profili professionali, più membership e anche essere
un soggetto cliente. Questo evita di trasformare una scelta iniziale dell'utente
in un'identità rigida e permette di aggiungere nuovi professionisti senza
alterare lo schema principale.

## Tabelle canoniche della fondazione

| Tabella | Responsabilità |
| --- | --- |
| `profiles` | Dati applicativi minimi e stato onboarding dell'account |
| `organization_types` | Catalogo descrittivo delle organizzazioni |
| `organizations` | Proprietà, stato e contesto collettivo |
| `organization_members` | Appartenenza account-organizzazione |
| `roles` | Ruoli globali o organizzativi |
| `permissions` | Capacità semantiche stabili |
| `role_permissions` | Mapping ruolo-permission |
| `member_roles` | Ruoli assegnati dentro un'organizzazione |
| `account_roles` | Ruoli platform assegnati direttamente all'account |
| `professional_types` | Catalogo professioni e categoria di verifica |
| `professional_profiles` | Profilo professionale separato dal profilo personale |
| `subjects` | Persona o organizzazione a cui si riferiscono i percorsi |
| `invitations` | Inviti organizzativi monouso e revocabili |
| `audit_events` | Traccia append-only delle operazioni sensibili |

## Regole di manutenzione

- Non usare `tipo_utente` come fonte di autorizzazione.
- Non aggiungere una colonna per ogni nuova professione o categoria di clinica.
- Usare cataloghi (`professional_types`, `organization_types`) per valori
  configurabili e ruoli/permission per l'accesso.
- Le qualifiche professionali richiedono verifica separata e stato esplicito.
- Le relazioni cliente-professionista-organizzazione saranno una feature di
  dominio sopra `subjects`, non una conseguenza della registrazione.
- I dati sanitari e i documenti sensibili avranno tabelle, policy e audit
  specifici; non vengono resi leggibili dal solo ruolo platform.


## Domain alignment addendum

**APPROVED**: `Subject` è l’identità patient globale; le relationship organizzative e professionali sono scoped. `ProfessionalProfile` è globale e non viene duplicato in `organization_members`. Il catalogo BBW è una libreria di template: `TreatmentDefinition` può essere `bbw_template`, organization-owned o professional-owned, mentre `TreatmentOffering` contiene il context operativo.

**TBD / BLOCKED**: la tassonomia qualifiche, la retention, lo storico globale condiviso, consensi, pagamenti, documenti avanzati e state machine complete non sono definiti sufficientemente.

**TECHNICAL DECISION**: appointment e availability legacy non fanno parte del modello canonico attivo e non devono essere usati come base per nuove feature.
