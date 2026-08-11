-- ─────────────────────────────────────────────────────────────────────────────
-- 00 — Schema Transformation: Production Baseline → New Architecture
-- ─────────────────────────────────────────────────────────────────────────────
-- Runs AFTER the prod baseline + data migrations.
-- Transforms the old "God Table" users model into the new split architecture.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: New Enums and Types
-- ══════════════════════════════════════════════════════════════════════════════

-- user_role: typed enum replacing tipo_utente TEXT
-- 'privato' and 'cliente' were synonyms — unified to 'cliente'
CREATE TYPE public.user_role AS ENUM (
  'admin',
  'medico',
  'estetista',
  'commerciale',
  'clinica',
  'cliente'
);

-- Normalize old subscription_status (UPPERCASE → lowercase) and add new values
-- Old enum had: 'ACTIVE', 'INACTIVE', 'CANCELLED', 'TRIALING'
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'inactive';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'trialing';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'past_due';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'unpaid';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'paused';

-- Loyalty transaction reason
CREATE TYPE public.loyalty_transaction_reason AS ENUM (
  'treatment_completed',
  'referral_bonus',
  'reward_redeemed',
  'admin_adjustment',
  'expiry',
  'bonus',
  'initial_migration'
);


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Global Functions
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_loyalty_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.user_loyalty_balances (user_id, points, updated_at)
  VALUES (NEW.user_id, NEW.balance_after, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET points     = EXCLUDED.points,
        updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: New Tables (not present in old schema)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Split tables from old users God Table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_business_profiles (
  user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  ragione_sociale TEXT,
  partita_iva     TEXT,
  pec             TEXT,
  codice_sdi      TEXT DEFAULT '0000000',
  iban            TEXT,
  azienda_via     TEXT,
  azienda_citta   TEXT,
  azienda_provincia TEXT,
  azienda_cap     TEXT,
  azienda_nazione TEXT DEFAULT 'IT',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_addresses (
  user_id   UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  via       TEXT,
  citta     TEXT,
  provincia TEXT,
  cap       TEXT,
  localita  TEXT,
  nazione   TEXT DEFAULT 'IT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.professional_credentials (
  user_id                                    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  numero_albo                                TEXT,
  numero_autorizzazione_asl                  TEXT,
  specializzazioni                           TEXT[],
  documento_tipo                             TEXT,
  documento_numero                           TEXT,
  documento_comune_rilascio                  TEXT,
  codice_medico                              TEXT UNIQUE,
  codice_commerciale                         TEXT UNIQUE,
  codice_riferimento                         TEXT,
  medico_riferimento_id                      UUID REFERENCES public.users(id),
  binding_request_id                         UUID,
  dichiarazione_assenza_carichi_giudiziari   BOOLEAN NOT NULL DEFAULT false,
  professional_signature_url                 TEXT,
  created_at                                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prof_cred_codice_medico ON public.professional_credentials (codice_medico)
  WHERE codice_medico IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.professional_studios (
  user_id    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  nome       TEXT,
  via        TEXT,
  citta      TEXT,
  provincia  TEXT,
  cap        TEXT,
  telefono   TEXT,
  website    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_consents (
  user_id     UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address  TEXT,
  user_agent  TEXT,
  version     TEXT NOT NULL DEFAULT '1.0',
  CONSTRAINT one_active_consent_per_user UNIQUE (user_id)
);

-- ── Catalog tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_treatment_catalog (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform_treatment_id UUID NOT NULL REFERENCES public.platform_treatments(id),
  price_override_cents  INTEGER CHECK (price_override_cents IS NULL OR price_override_cents >= 0),
  duration_override_min INTEGER CHECK (duration_override_min IS NULL OR duration_override_min > 0),
  points_override       INTEGER CHECK (points_override IS NULL OR points_override >= 0),
  consent_template_id   UUID REFERENCES public.consent_templates(id),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, platform_treatment_id)
);

CREATE INDEX IF NOT EXISTS idx_ctc_company ON public.company_treatment_catalog (company_id);

CREATE TABLE IF NOT EXISTS public.professional_catalog_assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_catalog_id    UUID REFERENCES public.company_treatment_catalog(id) ON DELETE CASCADE,
  platform_treatment_id UUID REFERENCES public.platform_treatments(id),
  price_override_cents  INTEGER CHECK (price_override_cents IS NULL OR price_override_cents >= 0),
  duration_override_min INTEGER CHECK (duration_override_min IS NULL OR duration_override_min > 0),
  points_override       INTEGER CHECK (points_override IS NULL OR points_override >= 0),
  consent_template_id   UUID REFERENCES public.consent_templates(id),
  disclaimer_accepted   BOOLEAN NOT NULL DEFAULT false,
  disclaimer_accepted_at TIMESTAMPTZ,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id, company_catalog_id),
  UNIQUE (professional_id, platform_treatment_id),
  CONSTRAINT pca_exactly_one_source CHECK (
    (company_catalog_id IS NOT NULL AND platform_treatment_id IS NULL)
    OR (company_catalog_id IS NULL AND platform_treatment_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pca_professional ON public.professional_catalog_assignments (professional_id);

-- ── Loyalty tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points_delta   INTEGER NOT NULL,
  balance_after  INTEGER NOT NULL,
  reason         public.loyalty_transaction_reason NOT NULL,
  reference_id   UUID,
  reference_type TEXT,
  created_by     UUID REFERENCES public.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_user ON public.loyalty_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_loyalty_balances (
  user_id    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  points     INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT non_negative_points CHECK (points >= 0)
);

CREATE TRIGGER trg_sync_loyalty_balance
  AFTER INSERT ON public.loyalty_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_loyalty_balance();

-- ── Consent / Auth tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.secure_otps (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference                  TEXT UNIQUE NOT NULL,
  consent_id                 UUID NOT NULL REFERENCES public.consent_documents(id),
  user_id                    UUID NOT NULL REFERENCES public.users(id),
  email                      TEXT NOT NULL,
  purpose                    TEXT NOT NULL DEFAULT 'consent_signature',
  code_hash                  TEXT NOT NULL,
  salt                       TEXT NOT NULL,
  requested_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                 TIMESTAMPTZ NOT NULL,
  request_ip                 TEXT NOT NULL,
  request_user_agent         TEXT NOT NULL,
  request_device_fingerprint JSONB,
  verified                   BOOLEAN NOT NULL DEFAULT false,
  verified_at                TIMESTAMPTZ,
  verify_ip                  TEXT,
  verify_user_agent          TEXT,
  attempts                   INTEGER NOT NULL DEFAULT 0,
  blocked                    BOOLEAN NOT NULL DEFAULT false,
  last_attempt_at            TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secure_otps_consent ON public.secure_otps (consent_id);

-- ── Registration / Contract tables ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contract_type         TEXT NOT NULL,
  contract_role         TEXT NOT NULL,
  document_ref          TEXT NOT NULL,
  document_version      TEXT NOT NULL,
  signer_role           TEXT NOT NULL,
  signature_method      TEXT NOT NULL DEFAULT 'GRAPHOMETRIC',
  signature_image_url   TEXT,
  signature_image_data  TEXT,
  used_stored_signature BOOLEAN NOT NULL DEFAULT false,
  ip_address            TEXT,
  user_agent            TEXT,
  signature_hash        TEXT NOT NULL,
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_user ON public.contract_signatures (user_id);

CREATE TABLE IF NOT EXISTS public.contract_reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL,
  sent_to       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'sent',
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_reminders_user ON public.contract_reminders (user_id, contract_type);

CREATE TABLE IF NOT EXISTS public.deferred_document_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_mime       TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deferred_uploads_user ON public.deferred_document_uploads (user_id, status);


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: Additive Schema Alterations (safe to run before data load)
-- ══════════════════════════════════════════════════════════════════════════════
-- Column renames (medico_id→professional_id, etc.) and backfill are done
-- in load_prod_data.sh AFTER seed data is loaded.

-- Add company_id to patient_professional_links
ALTER TABLE public.patient_professional_links
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ppl_company ON public.patient_professional_links (company_id)
  WHERE company_id IS NOT NULL;

-- Add deleted_at to contacts (soft delete support)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON public.contacts (owner_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- Add new platform_settings columns
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS llm_consent_provider TEXT NOT NULL DEFAULT 'claude',
  ADD COLUMN IF NOT EXISTS llm_consent_model TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS llm_image_provider TEXT NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS llm_image_model TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS asl_reminder_days INTEGER[] NOT NULL DEFAULT '{7,3,1}',
  ADD COLUMN IF NOT EXISTS asl_enforcement_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS asl_block_operations_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trash_users_retention_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS loyalty_tier_validity_months INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS loyalty_tiers JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS loyalty_rewards_catalog JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS editorial_promotional_carousel JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS payment_method_fees JSONB,
  ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: Drop Deprecated Tables and Columns
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop tables replaced by new architecture
-- contacts_trash: kept until load_prod_data.sh backfill runs, then dropped manually
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_auth_links CASCADE;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: Views
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.professional_catalog_effective AS
SELECT
  pca.id                                        AS assignment_id,
  pca.professional_id,
  pca.is_active,
  pt.id                                         AS platform_treatment_id,
  pt.slug, pt.name, pt.description, pt.category,
  pt.image_male_path, pt.image_female_path,
  pt.insurance_included, pt.location, pt.allowed_roles,
  ctc.id                                        AS company_catalog_id,
  ctc.company_id,
  COALESCE(pca.price_override_cents::numeric, ctc.price_override_cents::numeric, pt.price)  AS effective_price,
  COALESCE(pca.duration_override_min::text, ctc.duration_override_min::text, pt.duration)  AS effective_duration,
  COALESCE(pca.points_override, ctc.points_override, pt.points)                            AS effective_points,
  COALESCE(pca.consent_template_id, ctc.consent_template_id)                     AS effective_consent_template_id,
  pca.disclaimer_accepted,
  pca.disclaimer_accepted_at,
  pca.created_at, pca.updated_at
FROM public.professional_catalog_assignments pca
LEFT JOIN public.company_treatment_catalog ctc ON ctc.id = pca.company_catalog_id
JOIN public.platform_treatments pt
  ON pt.id = COALESCE(ctc.platform_treatment_id, pca.platform_treatment_id)
WHERE pca.is_active = true AND pt.is_active = true;

CREATE OR REPLACE VIEW public.user_subscription_status AS
SELECT
  u.id                           AS user_id,
  u.tipo_utente,
  ps.status                      AS subscription_status,
  ps.term_start,
  ps.term_end,
  ps.cancel_at_period_end,
  ps.stripe_subscription_id,
  CASE
    WHEN ps.status = 'active' AND (ps.term_end IS NULL OR ps.term_end > now()) THEN true
    ELSE false
  END                            AS is_active_subscriber
FROM public.users u
LEFT JOIN public.premium_subscriptions ps ON ps.user_id = u.id;

CREATE OR REPLACE VIEW public.patient_scope_view AS
SELECT
  ppl.id            AS link_id,
  ppl.patient_id,
  ppl.professional_id,
  ppl.company_id,
  ppl.status,
  ppl.invited_by,
  ppl.request_date,
  ppl.response_date,
  CASE WHEN ppl.company_id IS NOT NULL THEN 'clinic' ELSE 'personal' END AS scope
FROM public.patient_professional_links ppl
WHERE ppl.status = 'approved';


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 8: set_updated_at Triggers
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users', 'companies', 'company_members', 'company_member_invites',
    'company_rooms', 'company_treatment_catalog', 'professional_catalog_assignments',
    'custom_services', 'professional_catalog_items', 'company_service_catalog',
    'company_service_requests', 'platform_treatments',
    'bookings', 'booking_availability', 'booking_blocked_slots', 'booking_settings',
    'booking_notification_deliveries', 'treatments', 'gallery_items',
    'consent_templates', 'consent_documents',
    'patient_professional_links',
    'wallets', 'premium_subscriptions', 'loyalty_subscriptions',
    'user_loyalty_program_configs', 'contacts', 'invites', 'coupons',
    'platform_settings', 'message_threads',
    'finance_payment_sessions', 'finance_invoice_jobs', 'finance_payout_batches',
    'finance_installment_plans', 'payment_accounts',
    'commerciale_rewards', 'commerciale_settings',
    'credibility_checks',
    'email_audit_log', 'platform_logs',
    'premium_renewal_reminders', 'professional_contract_renewal_reminders',
    'user_business_profiles', 'user_addresses', 'professional_credentials',
    'professional_studios'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS set_%s_updated_at ON public.%I',
        tbl, tbl
      );
      EXECUTE format(
        'CREATE TRIGGER set_%s_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 9: Row Level Security
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = auth.uid());

ALTER TABLE public.user_business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_profiles_own" ON public.user_business_profiles FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_own" ON public.user_addresses FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.professional_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials_own" ON public.professional_credentials FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.professional_studios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "studios_own" ON public.professional_studios FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.patient_professional_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppl_professional_select" ON public.patient_professional_links
  FOR SELECT USING (professional_id = auth.uid());
CREATE POLICY "ppl_patient_select" ON public.patient_professional_links
  FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "ppl_company_select" ON public.patient_professional_links
  FOR SELECT USING (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = patient_professional_links.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'manager')
        AND cm.is_active = true
    )
  );

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_own_select" ON public.loyalty_ledger FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.user_loyalty_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "balance_own_select" ON public.user_loyalty_balances FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_own" ON public.contacts FOR ALL USING (owner_id = auth.uid());

ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent_docs_professional" ON public.consent_documents
  FOR SELECT USING (professional_id = auth.uid());
CREATE POLICY "consent_docs_client" ON public.consent_documents
  FOR SELECT USING (client_id = auth.uid());

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_all" ON public.platform_settings FOR SELECT USING (true);

ALTER TABLE public.company_treatment_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctc_member_select" ON public.company_treatment_catalog
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_treatment_catalog.company_id
        AND cm.user_id = auth.uid() AND cm.is_active = true
    )
  );

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS threads_participant ON public.message_threads;
CREATE POLICY "threads_participant" ON public.message_threads
  FOR SELECT USING (auth.uid() = ANY(participant_ids));

ALTER TABLE public.message_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_participant ON public.message_messages;
CREATE POLICY "messages_participant" ON public.message_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = message_messages.thread_id AND auth.uid() = ANY(t.participant_ids)
    )
  );
