ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_invites_owner ON public.invites (owner_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.invites (code);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites (email);
CREATE INDEX IF NOT EXISTS idx_invites_status ON public.invites (status, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invites_company ON public.invites (company_id) WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'profissional', 'paciente')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.company_member_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  nome TEXT,
  cognome TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'medico', 'estetista', 'cliente')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  accept_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_members_company_user_active
  ON public.company_members (company_id, user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_company_members_user_active
  ON public.company_members (user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_company_member_invites_company
  ON public.company_member_invites (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_member_invites_token
  ON public.company_member_invites (accept_token);

CREATE INDEX IF NOT EXISTS idx_company_member_invites_email_pending
  ON public.company_member_invites (company_id, lower(email))
  WHERE status = 'pending';
