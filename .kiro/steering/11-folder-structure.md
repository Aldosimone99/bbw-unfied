# 11 — Struttura delle cartelle

La struttura deve rendere visibile il confine tra rendering, feature, dominio e infrastruttura:

```text
src/
  app/
    (marketing)/          # landing e contenuti pubblici
    (auth)/               # accesso, registrazione, recupero, onboarding auth
    (platform)/           # superfici protette e contesto attivo
    auth/callback/        # callback tecnici
    forbidden.tsx         # superficie 403 condivisa
  proxy.ts                # refresh sessione Supabase per le richieste
  components/
    layout/               # layout/landing esistente
    forms/                # stili e primitive form condivise
    ui/                   # primitive UI senza business logic
  features/
    auth/ dashboard/      # flussi e viste già presenti
    authorization/ organizations/ profiles/ # organizations include Context Switcher/actions
    appointments/ consents/ notifications/ # introdurre solo quando approvate
  lib/
    supabase/             # adapter client/server già presenti
    errors/ validation/ utils/
  server/
    auth/ authorization/ security/ audit/
    services/ repositories/ # membership e active organization service
  types/                  # contratti condivisi minimizzati
supabase/
  config.toml
  migrations/             # migration identity/authorization già presenti
  seed.sql                # seed locale ripetibile già presente
  tests/                  # regressioni SQL RLS già presenti
```

Regole:

- `app` compone route e pagine; non contiene query o regole di dominio.
- `components/ui` non conosce ruoli, tenant o Supabase.
- `features` coordina UI e contratti della feature; le mutazioni sensibili chiamano service server.
- `server/services` esprime i casi d’uso; `server/repositories` incapsula accesso dati.
- `lib/supabase` contiene solo client/provider adapter, non policy sparse.
- `types` non è un contenitore per qualsiasi tipo: preferire ownership locale quando possibile.
- migrations e seed sono la fonte riproducibile del database.

Le cartelle ancora presenti con `.gitkeep` sono predisposizione; auth, dashboard, organizations, profile, security e validation contengono già codice. Non aggiungere `hooks`, `config`, `constants` o un nuovo design system come categorie automatiche: crearle solo quando esiste un uso coerente.
