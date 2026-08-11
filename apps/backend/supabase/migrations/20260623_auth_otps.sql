CREATE TABLE IF NOT EXISTS public.otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference UUID NOT NULL DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'consent')),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_otps_reference ON public.otps (reference);
CREATE INDEX idx_otps_email_purpose ON public.otps (email, purpose);
CREATE INDEX idx_otps_expires ON public.otps (expires_at);
