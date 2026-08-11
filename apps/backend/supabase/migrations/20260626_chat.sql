CREATE TABLE IF NOT EXISTS public.patient_professional_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  invited_by UUID REFERENCES public.users(id),
  request_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, professional_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_ppl_approved
  ON public.patient_professional_links (professional_id, patient_id)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_ppl_approved_patient
  ON public.patient_professional_links (patient_id, professional_id)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_ppl_company
  ON public.patient_professional_links (company_id)
  WHERE company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_allowed_to_chat(user_a UUID, user_b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_professional_links
    WHERE status = 'approved'
      AND (
        (professional_id = user_a AND patient_id = user_b)
        OR (professional_id = user_b AND patient_id = user_a)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.company_members a
    JOIN public.company_members b ON a.company_id = b.company_id
    WHERE a.user_id = user_a AND a.is_active = true
      AND b.user_id = user_b AND b.is_active = true
      AND (
        (a.role != 'paciente' AND b.role != 'paciente')
        OR (a.role = 'paciente' AND b.role IN ('owner', 'admin', 'staff'))
        OR (b.role = 'paciente' AND a.role IN ('owner', 'admin', 'staff'))
      )
  )
$$;

ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS user_a_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS user_b_id UUID REFERENCES public.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_1on1_pair
  ON public.message_threads (user_a_id, user_b_id)
  WHERE thread_type = 'chat';

ALTER TABLE public.patient_professional_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ppl_professional ON public.patient_professional_links;
CREATE POLICY ppl_professional ON public.patient_professional_links
  FOR SELECT USING (professional_id = auth.uid());

DROP POLICY IF EXISTS ppl_patient ON public.patient_professional_links;
CREATE POLICY ppl_patient ON public.patient_professional_links
  FOR SELECT USING (patient_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_chat_contacts(user_id UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  cognome TEXT,
  tipo_utente TEXT,
  avatar_url TEXT
) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT u.id, u.nome, u.cognome, u.tipo_utente, u.avatar_url
  FROM public.patient_professional_links ppl
  JOIN public.users u ON u.id = CASE
    WHEN ppl.professional_id = user_id THEN ppl.patient_id
    ELSE ppl.professional_id
  END
  WHERE ppl.status = 'approved'
    AND (ppl.professional_id = user_id OR ppl.patient_id = user_id)
  UNION
  SELECT DISTINCT u.id, u.nome, u.cognome, u.tipo_utente, u.avatar_url
  FROM public.company_members a
  JOIN public.company_members b ON a.company_id = b.company_id
  JOIN public.users u ON u.id = b.user_id
  WHERE a.user_id = user_id AND a.is_active = true
    AND b.user_id != user_id AND b.is_active = true
    AND (
      (a.role != 'paciente' AND b.role != 'paciente')
      OR (a.role = 'paciente' AND b.role IN ('owner', 'admin', 'staff'))
      OR (b.role = 'paciente' AND a.role IN ('owner', 'admin', 'staff'))
    )
$$;
