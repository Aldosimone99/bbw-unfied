-- 20260629_bookings.sql
-- Bookings core schema: PPL, invites, appointments, availability

-- Patient-Professional Links (PPL)
CREATE TABLE public.patient_professional_links (
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

CREATE INDEX idx_ppl_patient ON public.patient_professional_links(patient_id);
CREATE INDEX idx_ppl_professional ON public.patient_professional_links(professional_id);
CREATE INDEX idx_ppl_approved ON public.patient_professional_links(professional_id, status);

-- PPL Invites
CREATE TABLE public.ppl_invites (
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

CREATE INDEX idx_ppl_invites_token ON public.ppl_invites(accept_token);
CREATE INDEX idx_ppl_invites_professional ON public.ppl_invites(professional_id);

-- Bookings
CREATE TABLE public.bookings (
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

CREATE INDEX idx_bookings_professional ON public.bookings(professional_id, date);
CREATE INDEX idx_bookings_patient ON public.bookings(patient_id);
CREATE INDEX idx_bookings_date ON public.bookings(date);
CREATE INDEX idx_bookings_status ON public.bookings(status);

-- Booking availability
CREATE TABLE public.booking_availability (
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

CREATE INDEX idx_availability_professional ON public.booking_availability(professional_id);

-- Blocked slots
CREATE TABLE public.booking_blocked_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocked_slots_professional ON public.booking_blocked_slots(professional_id, date);

-- Booking settings
CREATE TABLE public.booking_settings (
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

-- Notification deliveries
CREATE TABLE public.booking_notification_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  professional_id UUID,
  patient_id      UUID,
  notification_type TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Company rooms
CREATE TABLE public.company_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Treatments
CREATE TABLE public.treatments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  duration        INTEGER NOT NULL DEFAULT 30,
  price_cents     INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Binding requests (compatibility table - existing references only)
CREATE TABLE public.binding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
