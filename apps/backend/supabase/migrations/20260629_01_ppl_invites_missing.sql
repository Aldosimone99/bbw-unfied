-- Remediação: ppl_invites não foi criada durante 20260629_bookings porque
-- CREATE TABLE public.bookings abortou a transação (tabela já existia na baseline).

CREATE TABLE IF NOT EXISTS public.ppl_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  patient_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  nome            TEXT,
  cognome         TEXT,
  accept_token    TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at      TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppl_invites_token        ON public.ppl_invites(accept_token);
CREATE INDEX IF NOT EXISTS idx_ppl_invites_professional ON public.ppl_invites(professional_id);
