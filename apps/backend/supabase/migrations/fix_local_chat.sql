-- Fix missing columns from 20260625_messaging.sql
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS thread_type TEXT NOT NULL DEFAULT 'notification'
    CHECK (thread_type IN ('notification', 'chat'));

-- Drop and recreate get_chat_contacts with correct column name (avatar not avatar_url)
DROP FUNCTION IF EXISTS public.get_chat_contacts(UUID);

CREATE OR REPLACE FUNCTION public.get_chat_contacts(user_id UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  cognome TEXT,
  tipo_utente TEXT,
  avatar_url TEXT,
  company_id UUID
) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT u.id, u.nome, u.cognome, u.tipo_utente::TEXT, u.avatar, ppl.company_id
  FROM public.patient_professional_links ppl
  JOIN public.users u ON u.id = CASE
    WHEN ppl.professional_id = get_chat_contacts.user_id THEN ppl.patient_id
    ELSE ppl.professional_id
  END
  WHERE ppl.status = 'approved'
    AND (ppl.professional_id = get_chat_contacts.user_id OR ppl.patient_id = get_chat_contacts.user_id)
  UNION
  SELECT DISTINCT u.id, u.nome, u.cognome, u.tipo_utente::TEXT, u.avatar, b.company_id
  FROM public.company_members a
  JOIN public.company_members b ON a.company_id = b.company_id
  JOIN public.users u ON u.id = b.user_id
  WHERE a.user_id = get_chat_contacts.user_id AND a.is_active = true
    AND b.user_id != get_chat_contacts.user_id AND b.is_active = true
    AND (
      (a.role != 'paciente' AND b.role != 'paciente')
      OR (a.role = 'paciente' AND b.role IN ('owner', 'admin', 'staff'))
      OR (b.role = 'paciente' AND a.role IN ('owner', 'admin', 'staff'))
    )
$$;

-- Recreate the unique index (may fail if duplicate pairs exist, skip in that case)
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_1on1_pair
  ON public.message_threads (user_a_id, user_b_id)
  WHERE thread_type = 'chat';
