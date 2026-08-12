-- Account-first registration.
-- The authenticated account is created before BBW asks for profile or context
-- data. The legacy tipo_utente value "privato" is only a neutral persisted
-- state here; it is not an authorization grant.

ALTER TABLE public.users
  ALTER COLUMN nome DROP NOT NULL,
  ALTER COLUMN codice_fiscale DROP NOT NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'profile_required',
  ADD COLUMN IF NOT EXISTS requested_account_type TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE public.users
SET onboarding_status = CASE
  WHEN tipo_utente::text = 'privato' OR nome IS NULL OR codice_fiscale IS NULL THEN 'profile_required'
  ELSE 'completed'
END
WHERE onboarding_status IS NULL OR onboarding_status = 'profile_required';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_onboarding_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_onboarding_status_check
  CHECK (onboarding_status IN ('profile_required', 'account_type_required', 'completed'));

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_requested_account_type_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_requested_account_type_check
  CHECK (
    requested_account_type IS NULL OR requested_account_type IN (
      'personal',
      'healthcare_professional',
      'beauty_professional',
      'organization',
      'commercial'
    )
  );

CREATE INDEX IF NOT EXISTS idx_users_onboarding_status
  ON public.users (onboarding_status);
