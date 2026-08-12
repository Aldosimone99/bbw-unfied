CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL,
  contract_role TEXT NOT NULL,
  document_ref TEXT NOT NULL,
  document_version TEXT NOT NULL,
  signer_role TEXT NOT NULL,
  signature_method TEXT NOT NULL DEFAULT 'GRAPHOMETRIC',
  signature_image_url TEXT,
  signature_image_data TEXT,
  used_stored_signature BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  signature_hash TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_user ON public.contract_signatures (user_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_type ON public.contract_signatures (contract_type, contract_role);

CREATE TABLE IF NOT EXISTS public.contract_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL,
  sent_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_reminders_user ON public.contract_reminders (user_id, contract_type);

CREATE TABLE IF NOT EXISTS public.professional_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  professional_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_update TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  asl_due_at TIMESTAMPTZ,
  identity_due_at TIMESTAMPTZ,
  insurance_due_at TIMESTAMPTZ,
  operational_blocked BOOLEAN NOT NULL DEFAULT false,
  operational_block_reason TEXT,
  notes TEXT,
  checklist JSONB,
  UNIQUE (user_id, professional_type)
);

CREATE TABLE IF NOT EXISTS public.verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.professional_verifications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  rejection_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_verification ON public.verification_documents (verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_type ON public.verification_documents (type);

CREATE TABLE IF NOT EXISTS public.deferred_document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_mime TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deferred_uploads_user ON public.deferred_document_uploads (user_id, status);
