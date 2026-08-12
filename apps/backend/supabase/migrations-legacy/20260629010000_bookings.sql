-- 20260629010000_bookings.sql
-- Bookings core schema: PPL, invites, appointments, availability

-- Patient-Professional Links (PPL)
CREATE TABLE IF NOT EXISTS public.patient_professional_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  invited_by      UUID REFERENCES public.users(id),
  clinic_access   BOOLEAN NOT NULL DEFAULT false,
  request_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_date   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, professional_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_ppl_patient ON public.patient_professional_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_ppl_professional ON public.patient_professional_links(professional_id);
CREATE INDEX IF NOT EXISTS idx_ppl_approved ON public.patient_professional_links(professional_id, status);

ALTER TABLE public.patient_professional_links
  ADD COLUMN IF NOT EXISTS clinic_access BOOLEAN NOT NULL DEFAULT false;

-- PPL Invites
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

CREATE INDEX IF NOT EXISTS idx_ppl_invites_token ON public.ppl_invites(accept_token);
CREATE INDEX IF NOT EXISTS idx_ppl_invites_professional ON public.ppl_invites(professional_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  patient_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  room_id         UUID REFERENCES public.company_rooms(id) ON DELETE SET NULL,
  service_id      UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  service_name    TEXT,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  duration        INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes           TEXT,
  price_cents     INTEGER,
  points          INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS professional_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER;

UPDATE public.bookings
SET professional_id = COALESCE(professional_id, medico_id),
    patient_id = COALESCE(patient_id, cliente_id),
    price_cents = COALESCE(price_cents, ROUND(price * 100)::INTEGER)
WHERE professional_id IS NULL OR patient_id IS NULL OR price_cents IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_professional ON public.bookings(professional_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_patient ON public.bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- Booking availability
CREATE TABLE IF NOT EXISTS public.booking_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id, company_id, day_of_week, start_time)
);

ALTER TABLE public.booking_availability
  ADD COLUMN IF NOT EXISTS professional_id UUID;

UPDATE public.booking_availability
SET professional_id = COALESCE(professional_id, medico_id)
WHERE professional_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_availability_professional ON public.booking_availability(professional_id);

-- Blocked slots
CREATE TABLE IF NOT EXISTS public.booking_blocked_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_blocked_slots
  ADD COLUMN IF NOT EXISTS professional_id UUID;

UPDATE public.booking_blocked_slots
SET professional_id = COALESCE(professional_id, medico_id)
WHERE professional_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_blocked_slots_professional ON public.booking_blocked_slots(professional_id, date);

-- Booking settings
CREATE TABLE IF NOT EXISTS public.booking_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  slot_duration   INTEGER NOT NULL DEFAULT 30,
  advance_days    INTEGER NOT NULL DEFAULT 60,
  allow_online    BOOLEAN NOT NULL DEFAULT true,
  auto_confirm    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id, company_id)
);

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS professional_id UUID;

UPDATE public.booking_settings
SET professional_id = COALESCE(professional_id, medico_id)
WHERE professional_id IS NULL;

-- Notification deliveries
CREATE TABLE IF NOT EXISTS public.booking_notification_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  professional_id UUID,
  patient_id      UUID,
  notification_type TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_notification_deliveries
  ADD COLUMN IF NOT EXISTS professional_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID;

-- Company rooms
CREATE TABLE IF NOT EXISTS public.company_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Treatments
CREATE TABLE IF NOT EXISTS public.treatments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  duration        INTEGER NOT NULL DEFAULT 30,
  price_cents     INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS professional_id UUID,
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER;

UPDATE public.treatments
SET professional_id = COALESCE(professional_id, medico_id),
    name = COALESCE(name, treatment_name),
    price_cents = COALESCE(price_cents, ROUND(price * 100)::INTEGER)
WHERE professional_id IS NULL OR name IS NULL OR price_cents IS NULL;

-- Binding requests (compatibility table - existing references only)
CREATE TABLE IF NOT EXISTS public.binding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
