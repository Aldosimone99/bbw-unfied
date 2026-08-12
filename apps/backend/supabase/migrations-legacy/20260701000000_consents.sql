-- Consent Templates
CREATE TABLE IF NOT EXISTS public.consent_templates (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  UUID NOT NULL REFERENCES public.users(id),
  owner_type                TEXT NOT NULL CHECK (owner_type IN ('medico', 'estetista')),
  company_id                UUID REFERENCES public.companies(id),
  name                      TEXT NOT NULL,
  description               TEXT,
  category                  TEXT NOT NULL,
  treatment_types           TEXT[],
  content_html              TEXT NOT NULL,
  source                    TEXT NOT NULL DEFAULT 'editor'
                              CHECK (source IN ('editor', 'uploaded')),
  requires_clinic_signature BOOLEAN NOT NULL DEFAULT true,
  disclaimer_accepted       BOOLEAN NOT NULL DEFAULT false,
  disclaimer_accepted_at    TIMESTAMPTZ,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_owner" ON public.consent_templates
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "templates_company_members" ON public.consent_templates
  FOR SELECT USING (
    company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = consent_templates.company_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- Consent Documents
CREATE TABLE IF NOT EXISTS public.consent_documents (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id               UUID REFERENCES public.consent_templates(id),
  treatment_id              UUID NOT NULL,
  professional_id           UUID NOT NULL REFERENCES public.users(id),
  client_id                 UUID NOT NULL REFERENCES public.users(id),
  company_id                UUID REFERENCES public.companies(id),
  professional_role         TEXT,
  status                    TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN (
                                'draft',
                                'awaiting_doctor_signature',
                                'doctor_signed',
                                'awaiting_clinic_signature',
                                'clinic_signed',
                                'awaiting_client_signature',
                                'fully_signed',
                                'revoked'
                              )),
  current_version_id        UUID,
  content_hash              TEXT,
  draft_created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at               TIMESTAMPTZ,
  professional_signed_at    TIMESTAMPTZ,
  clinic_signed_at          TIMESTAMPTZ,
  client_signed_at          TIMESTAMPTZ,
  revoked_at                TIMESTAMPTZ,
  revoked_reason            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (treatment_id)
);

ALTER TABLE public.consent_documents
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_participant" ON public.consent_documents
  FOR ALL USING (
    professional_id = auth.uid()
    OR client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = consent_documents.company_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_consent_documents_professional ON public.consent_documents(professional_id);
CREATE INDEX IF NOT EXISTS idx_consent_documents_client ON public.consent_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_consent_documents_status ON public.consent_documents(status);
CREATE INDEX IF NOT EXISTS idx_consent_documents_company ON public.consent_documents(company_id);

-- Consent Document Versions (append-only)
CREATE TABLE IF NOT EXISTS public.consent_document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id      UUID NOT NULL REFERENCES public.consent_documents(id),
  version_number  INTEGER NOT NULL,
  content_html    TEXT NOT NULL,
  content_hash    TEXT NOT NULL,
  changes_summary TEXT,
  created_by      UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (consent_id, version_number)
);

ALTER TABLE public.consent_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "versions_participant" ON public.consent_document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.consent_documents d
      WHERE d.id = consent_document_versions.consent_id
        AND (d.professional_id = auth.uid()
          OR d.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members m
            WHERE m.company_id = d.company_id
              AND m.user_id = auth.uid()
              AND m.is_active = true
          ))
    )
  );

-- Consent Signatures (append-only)
CREATE TABLE IF NOT EXISTS public.consent_signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id            UUID NOT NULL REFERENCES public.consent_documents(id),
  version_id            UUID NOT NULL REFERENCES public.consent_document_versions(id),
  signer_id             UUID NOT NULL REFERENCES public.users(id),
  signer_role           TEXT NOT NULL CHECK (signer_role IN ('doctor', 'clinic', 'client')),
  signer_name           TEXT NOT NULL,
  signer_email          TEXT,
  method                TEXT NOT NULL CHECK (method IN ('GRAPHOMETRIC', 'OTP_EMAIL')),
  signature_image_data  TEXT,
  otp_reference         TEXT,
  otp_verified_at       TIMESTAMPTZ,
  signed_at             TIMESTAMPTZ NOT NULL,
  ip_address            TEXT,
  user_agent            TEXT,
  device_fingerprint    JSONB,
  geolocation           JSONB,
  document_hash         TEXT NOT NULL,
  signature_hash        TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures_participant" ON public.consent_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.consent_documents d
      WHERE d.id = consent_signatures.consent_id
        AND (d.professional_id = auth.uid()
          OR d.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members m
            WHERE m.company_id = d.company_id
              AND m.user_id = auth.uid()
              AND m.is_active = true
          ))
    )
  );

-- Consent Audit Logs (append-only)
CREATE TABLE IF NOT EXISTS public.consent_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id      UUID NOT NULL REFERENCES public.consent_documents(id),
  version_id      UUID REFERENCES public.consent_document_versions(id),
  signature_id    UUID REFERENCES public.consent_signatures(id),
  actor_id        UUID,
  actor_role      TEXT NOT NULL,
  actor_name      TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  event_data      JSONB,
  previous_status TEXT,
  new_status      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_participant_read" ON public.consent_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.consent_documents d
      WHERE d.id = consent_audit_logs.consent_id
        AND (d.professional_id = auth.uid()
          OR d.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members m
            WHERE m.company_id = d.company_id
              AND m.user_id = auth.uid()
              AND m.is_active = true
          ))
    )
  );

-- Consent Share Tokens
CREATE TABLE IF NOT EXISTS public.consent_share_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id  UUID NOT NULL REFERENCES public.consent_documents(id),
  token       TEXT NOT NULL UNIQUE,
  created_by  UUID NOT NULL REFERENCES public.users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_tokens_select" ON public.consent_share_tokens
  FOR SELECT USING (true);

-- Secure OTPs
CREATE TABLE IF NOT EXISTS public.secure_otps (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference                 TEXT NOT NULL UNIQUE,
  consent_id                UUID NOT NULL REFERENCES public.consent_documents(id),
  user_id                   UUID NOT NULL REFERENCES public.users(id),
  email                     TEXT NOT NULL,
  purpose                   TEXT NOT NULL DEFAULT 'consent_signature',
  code_hash                 TEXT NOT NULL,
  salt                      TEXT NOT NULL,
  expires_at                TIMESTAMPTZ NOT NULL,
  attempts                  INTEGER NOT NULL DEFAULT 0,
  blocked                   BOOLEAN NOT NULL DEFAULT false,
  verified                  BOOLEAN NOT NULL DEFAULT false,
  verified_at               TIMESTAMPTZ,
  verify_ip                 TEXT,
  verify_user_agent         TEXT,
  request_ip                TEXT NOT NULL,
  request_user_agent        TEXT,
  request_device_fingerprint JSONB,
  last_attempt_at           TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.secure_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "otps_owner" ON public.secure_otps
  FOR ALL USING (user_id = auth.uid());
