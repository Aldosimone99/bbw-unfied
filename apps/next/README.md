# Beauty Broker World (BBW)

[🇮🇹 Italiano](#italiano) | [🇬🇧 English](#english)

---

<a name="italiano"></a>
## 🇮🇹 Versione Italiana

Una piattaforma digitale italiana per gestire relazioni e percorsi nell'ecosistema beauty, medicina estetica, chirurgia plastica, longevità e benessere.

### 📋 Stato del progetto

**Fase attuale**: Sviluppo iniziale

Il repository contiene:
- ✅ Landing page marketing completa con design system raffinato
- ✅ Architettura Next.js App Router con TypeScript strict
- ✅ Integrazione Supabase (Auth, Database PostgreSQL 17, Storage)
- ✅ Pagine visuali di autenticazione (login, registrazione, onboarding)
- ✅ Onboarding minimo con profilo personale, tipo richiesto e contesto organizzativo
- ✅ Membership multi-organizzazione e Context Switcher con active organization server-side
- ✅ RBAC contestuale, permission server-side, guard dashboard e RLS iniziale
- ✅ Migration riproducibili e test automatici Vitest/SQL per Identity & Authorization
- ✅ Sistema di documentazione architetturale completo (14 steering files)
- ⏳ Inviti, gestione operativa delle membership e logica di business oltre identità, organizzazioni e autorizzazione iniziale

### 🎯 Visione del prodotto

BBW non è un semplice marketplace, ma una piattaforma per la **continuità del percorso** che:

- Collega persone, professionisti, organizzazioni e servizi in modo sicuro
- Gestisce relazioni esplicite tra soggetti con autorizzazioni server-side
- Rende tracciabili e riproducibili le operazioni sensibili
- Protegge dati personali e categorie particolari con architettura privacy-by-design
- Mantiene il brand caldo, raffinato e premium su tutte le superfici

#### Utenti coinvolti

- **Persone/pazienti**: soggetti che seguono percorsi di bellezza e benessere
- **Professionisti**: persone con profilo professionale, appartenenti a una o più organizzazioni
- **Organizzazioni/strutture**: cliniche, studi, reti che possiedono risorse e servizi
- **Operatori BBW**: supporto interno con accesso limitato e motivato

#### MVP proposto (da approvare)

- Registrazione, verifica email, accesso, logout e recupero password
- Profilo personale separato dall'identità di autenticazione
- Onboarding guidato e scelta contesto operativo
- Gestione organizzazioni, inviti, membership e permessi
- Profili professionali verificati
- Relazioni esplicite paziente-professionista/organizzazione
- Catalogo servizi/trattamenti
- Appuntamenti con ownership, partecipanti e stati
- Template consensi versionati, documenti e firme
- Allegati in bucket privati
- Notifiche essenziali e audit operazioni sensibili
- Dashboard contestuale

### 🏗️ Architettura

#### Stack tecnologico

```json
{
  "Framework": "Next.js 16.2+ (App Router)",
  "UI": "React 19.2+",
  "Linguaggio": "TypeScript 6.0+ (strict mode)",
  "Backend": "Supabase (PostgreSQL 17, Auth, Storage)",
  "Validazione": "Zod 4.4+",
  "Styling": "CSS Modules + CSS globale + Tailwind",
  "Testing": "Vitest 4.1+"
}
```

#### Principi architetturali

**Direzione delle dipendenze**:
```
UI/Page → Server Action/Route Handler → Service → Repository → Supabase/PostgreSQL
```

**Separazione chiara**:
- **Server Components**: rendering, lettura autorizzata, composizione pagine
- **Client Components**: interazione, stato locale, UX — **non decidono autorizzazioni**
- **Server Actions**: mutazioni da UI interna con validazione Zod
- **Route Handlers**: webhook, API esterne, download, callback OAuth
- **Service layer**: casi d'uso, invarianti, transazioni
- **Repository**: query parametrizzate, mapping DTO, filtri tenant
- **PostgreSQL RLS**: ultima barriera di sicurezza database

### 🎨 Design System

#### Palette colori (brand BBW)

```css
--gold: #C8A25A          /* Oro primario */
--champagne: #EFE7DC     /* Oro chiaro */
--ivory: #F7F3EE         /* Avorio */
--powder: #F7F3EE        /* Cipria */
--warm-beige: #E7DDD0
--terracotta: #B38845
--brown: #2F2824         /* Marrone */
--coffee: #2F2824        /* Caffè */
```

#### Tipografia

- **Font principale**: `Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif`
- **Display/Hero**: peso 300-380, line-height 0.86-0.96
- **Body**: line-height 1.42-1.62
- **Label**: uppercase, letter-spacing

#### Principi UI

- Atmosfera **calda, editoriale, premium, sobria**
- Layout ampi con molto respiro
- Bordi sottili (1px), radius 8px
- Bottoni pill con `border-radius: 999px`
- Motion elegante (0.22s-0.35s)
- Rispetto `prefers-reduced-motion`

#### Iconografia applicativa

- Usare esclusivamente `lucide-react`, con outline, `strokeWidth={1.75}`, cap e join round.
- Riutilizzare la mappa ufficiale in [13-app-design-system.md](.kiro/steering/13-app-design-system.md) per sidebar, header, quick actions, card, tabelle, modali e dropdown.
- Dimensioni standard: 18px per sidebar/header/quick actions, 20px per le card.
- Le SVG Lucide devono usare il reset CSS Safari-safe documentato nello steering file; bordi e background appartengono solo al contenitore dell'icona.

### 🚀 Setup locale

#### Prerequisiti

- Node.js 18+ e npm
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (per Supabase locale)

#### Installazione

```bash
# Clone del repository
git clone <repository-url>
cd bbwlanding

# Installazione dipendenze
npm install

# Copia file environment
cp .env.example .env.local

# Configura .env.local con:
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
# NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Per il deployment, imposta in Vercel le stesse variabili usando l’URL pubblico
# della produzione per NEXT_PUBLIC_SITE_URL. Per il deployment attuale:
# NEXT_PUBLIC_SITE_URL=https://bbwlanding.vercel.app
# In Supabase Auth aggiungi https://bbwlanding.vercel.app/auth/callback
# agli URL di redirect consentiti.
```

#### Avvio

```bash
# Avvia Supabase
supabase start

# Applica le migration locali senza resettare il database
supabase migration up --local

# Avvia Next.js
npm run dev

# Apri http://localhost:3000
```

#### Comandi disponibili

```bash
npm run dev         # Development server
npm run build       # Build produzione
npm run start       # Start produzione
npm run typecheck   # Verifica tipi TypeScript
npm run test        # Esegui test
npm run lint        # ESLint
```

`npm run lint` passa senza errori; restano 7 warning preesistenti relativi all'uso di `<img>` nei flussi auth e nella shell applicativa.

Per verificare o aggiornare il progetto Supabase collegato:

```bash
supabase migration list
supabase migration up --linked
```

### 🔐 Sicurezza e privacy

#### Principi fondamentali

- **Privacy by design**: minimo privilegio, separazione dati, audit
- **Autorizzazione server-side**: nessuna decisione solo client
- **RLS**: policy PostgreSQL come ultima barriera
- **Multi-tenancy**: risorse collegate a tenant verificabile
- **Gestione segreti**: niente secret in client

#### Classificazione dati

- **Comune**: contenuti marketing pubblici
- **Personale**: email, nome, contatti, membership
- **Categoria particolare**: dati su salute, trattamenti
- **Segreto**: chiavi, token, credenziali

### 📖 Documentazione architetturale

Il registro operativo delle modifiche a identità, onboarding e autorizzazione è disponibile in [docs/identity-and-authorization.md](docs/identity-and-authorization.md). Va aggiornato per cambiamenti importanti a registrazione, login, sessioni, ruoli, permessi, RLS e migration.

Il progetto usa **Kiro Steering Files** in `.kiro/steering/`:

- `00-product.md` — Visione prodotto, MVP
- `01-architecture.md` — Architettura Next.js
- `02-domain-model.md` — Entità, relazioni
- `03-database.md` — Database, migrazioni
- `04-auth-and-permissions.md` — Auth, RBAC
- `05-security.md` — Sicurezza, threat model
- `06-coding-standards.md` — Standard TypeScript
- `07-testing.md` — Strategia test
- `08-ui.md` — Design system
- `09-definition-of-done.md` — Checklist DoD
- `10-api.md` — Contratti API
- `11-folder-structure.md` — Struttura cartelle
- `12-ai-rules.md` — Regole AI
- `13-app-design-system.md` — Stile applicativo e mappa ufficiale delle icone Lucide

**Leggi questi file prima di implementare feature.**

### 🤝 Contribuire

#### Prima di modificare codice

1. Leggi `.kiro/steering/00-product.md`
2. Leggi `.kiro/steering/01-architecture.md`
3. Leggi `08-ui.md` e `13-app-design-system.md` per modifiche UI
4. Verifica `02-domain-model.md`

#### Regole chiave

- ✅ TypeScript strict, niente `any`
- ✅ Validazione input con Zod
- ✅ Autorizzazione server-side
- ✅ RLS attiva su tabelle sensibili
- ✅ Preservare design system
- ❌ Non duplicare codice
- ❌ Non implementare feature "Da confermare"

### 📝 Decisioni da confermare

- Significato legale firma digitale
- Dati sanitari effettivamente trattati
- Processo verifica professionisti
- Retention e cancellazione dati
- Pagamenti e assicurazioni
- MFA e requisiti sicurezza

### 📄 Licenza

Proprietario: Beauty Broker World  
Uso privato — non distribuire senza autorizzazione.

---

<a name="english"></a>
## 🇬🇧 English Version

An Italian digital platform for managing relationships and journeys in the beauty, aesthetic medicine, plastic surgery, longevity, and wellness ecosystem.

### 📋 Project Status

**Current Phase**: Initial Development

The repository contains:
- ✅ Complete marketing landing page with refined design system
- ✅ Next.js App Router architecture with TypeScript strict mode
- ✅ Supabase integration (Auth, PostgreSQL 17 Database, Storage)
- ✅ Visual authentication pages (login, registration, onboarding)
- ✅ Minimum onboarding with personal profile, requested account type, and organization context
- ✅ Multi-organization memberships and server-side active organization Context Switcher
- ✅ Contextual RBAC, server-side permissions, dashboard guard, and initial RLS
- ✅ Reproducible migrations and Vitest/SQL tests for Identity & Authorization
- ✅ Comprehensive architectural documentation (14 steering files)
- ⏳ Invitations, operational membership management, and business logic beyond the initial identity, organization, and authorization foundation

### 🎯 Product Vision

BBW is not a simple marketplace, but a platform for **journey continuity** that:

- Connects people, professionals, organizations, and services securely
- Manages explicit relationships with server-side authorization
- Makes sensitive operations traceable and reproducible
- Protects personal data with privacy-by-design architecture
- Maintains a warm, refined, and premium brand

#### Stakeholders

- **People/patients**: subjects following beauty and wellness journeys
- **Professionals**: people with professional profiles, belonging to organizations
- **Organizations/facilities**: clinics, practices, networks owning resources
- **BBW operators**: internal support with limited access

#### Proposed MVP (to be approved)

- Registration, email verification, login, logout, password recovery
- Personal profile separated from authentication identity
- Guided onboarding and context selection
- Organization management, invitations, memberships, permissions
- Verified professional profiles
- Explicit patient-professional/organization relationships
- Services/treatments catalog
- Appointments with ownership, participants, states
- Versioned consent templates, documents, signatures
- Attachments in private buckets
- Essential notifications and audit logs
- Contextual dashboard

### 🏗️ Architecture

#### Technology Stack

```json
{
  "Framework": "Next.js 16.2+ (App Router)",
  "UI": "React 19.2+",
  "Language": "TypeScript 6.0+ (strict mode)",
  "Backend": "Supabase (PostgreSQL 17, Auth, Storage)",
  "Validation": "Zod 4.4+",
  "Styling": "CSS Modules + Global CSS + Tailwind",
  "Testing": "Vitest 4.1+"
}
```

#### Architectural Principles

**Dependency direction**:
```
UI/Page → Server Action/Route Handler → Service → Repository → Supabase/PostgreSQL
```

**Clear separation**:
- **Server Components**: rendering, authorized reads, page composition
- **Client Components**: interaction, local state, UX — **do not decide authorization**
- **Server Actions**: mutations from internal UI with Zod validation
- **Route Handlers**: webhooks, external APIs, downloads, OAuth callbacks
- **Service layer**: use cases, invariants, transactions
- **Repository**: parameterized queries, DTO mapping, tenant filters
- **PostgreSQL RLS**: final database security barrier

### 🎨 Design System

#### Color Palette (BBW Brand)

```css
--gold: #C8A25A          /* Primary gold */
--champagne: #EFE7DC     /* Light gold */
--ivory: #F7F3EE         /* Ivory */
--powder: #F7F3EE        /* Powder */
--warm-beige: #E7DDD0
--terracotta: #B38845
--brown: #2F2824         /* Brown */
--coffee: #2F2824        /* Coffee */
```

#### Typography

- **Primary font**: `Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif`
- **Display/Hero**: weight 300-380, line-height 0.86-0.96
- **Body**: line-height 1.42-1.62
- **Label**: uppercase, letter-spacing

#### UI Principles

- **Warm, editorial, premium, sober** atmosphere
- Wide layouts with generous spacing
- Thin borders (1px), 8px radius
- Pill buttons with `border-radius: 999px`
- Elegant motion (0.22s-0.35s)
- Respect `prefers-reduced-motion`

#### Application iconography

- Use only `lucide-react`, with outline icons, `strokeWidth={1.75}`, round caps and round joins.
- Reuse the official map in [13-app-design-system.md](.kiro/steering/13-app-design-system.md) across sidebar, header, quick actions, cards, tables, modals and dropdowns.
- Standard sizes: 18px for sidebar/header/quick actions, 20px for cards.
- Lucide SVGs must use the Safari-safe CSS reset documented in the steering file; borders and backgrounds belong only to the icon container.

### 🚀 Local Setup

#### Prerequisites

- Node.js 18+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for local Supabase)

#### Installation

```bash
# Clone repository
git clone <repository-url>
cd bbwlanding

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Configure .env.local with:
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

#### Start

```bash
# Start Supabase
supabase start

# Apply local migrations without resetting the database
supabase migration up --local

# Start Next.js
npm run dev

# Open http://localhost:3000
```

#### Available Commands

```bash
npm run dev         # Development server
npm run build       # Production build
npm run start       # Production start
npm run typecheck   # TypeScript type checking
npm run test        # Run tests
```

To verify or update the linked Supabase project:

```bash
supabase migration list
supabase migration up --linked
```

### 🔐 Security and Privacy

#### Core Principles

- **Privacy by design**: minimum privilege, data separation, audit
- **Server-side authorization**: no client-only security decisions
- **RLS**: PostgreSQL policies as final barrier
- **Multi-tenancy**: resources linked to verifiable tenant
- **Secrets management**: no secrets in client

#### Data Classification

- **Public**: marketing content
- **Personal**: email, name, contacts, memberships
- **Special category**: health data, treatments
- **Secret**: keys, tokens, credentials

### 📖 Architectural Documentation

The operational change log for identity, onboarding, and authorization is available at [docs/identity-and-authorization.md](docs/identity-and-authorization.md). Update it for important changes to registration, login, sessions, roles, permissions, RLS, and migrations.

The project uses **Kiro Steering Files** in `.kiro/steering/`:

- `00-product.md` — Product vision, MVP
- `01-architecture.md` — Next.js architecture
- `02-domain-model.md` — Entities, relationships
- `03-database.md` — Database, migrations
- `04-auth-and-permissions.md` — Auth, RBAC
- `05-security.md` — Security, threat model
- `06-coding-standards.md` — TypeScript standards
- `07-testing.md` — Testing strategy
- `08-ui.md` — Design system
- `09-definition-of-done.md` — DoD checklist
- `10-api.md` — API contracts
- `11-folder-structure.md` — Folder structure
- `12-ai-rules.md` — AI rules
- `13-app-design-system.md` — Application visual system and official Lucide icon map

**Read these files before implementing features.**

### 🤝 Contributing

#### Before Modifying Code

1. Read `.kiro/steering/00-product.md`
2. Read `.kiro/steering/01-architecture.md`
3. Read `08-ui.md` and `13-app-design-system.md` for UI changes
4. Check `02-domain-model.md`

#### Key Rules

- ✅ TypeScript strict, no `any`
- ✅ Input validation with Zod
- ✅ Server-side authorization
- ✅ RLS on sensitive tables
- ✅ Preserve design system
- ❌ Don't duplicate code
- ❌ Don't implement "To be confirmed" features

### 📝 Decisions to be Confirmed

- Legal meaning of digital signature
- Health data actually processed
- Professional verification process
- Data retention and deletion
- Payments and insurance
- MFA and security requirements

### 📄 License

Owner: Beauty Broker World  
Private use — do not distribute without authorization.

---

**Note**: This is an early-stage project. The marketing landing page is complete, but MVP application features are to be implemented following the architecture defined in steering files.
