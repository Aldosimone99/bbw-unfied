CREATE TYPE public.user_role AS ENUM (
  'admin',
  'medico',
  'estetista',
  'commerciale',
  'clinica',
  'cliente'
);

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,

  nome TEXT,
  cognome TEXT,
  titolo TEXT,
  telefono TEXT,
  avatar TEXT,
  data_nascita DATE,
  sesso TEXT,
  codice_fiscale TEXT,

  tipo_utente public.user_role NOT NULL,
  tipo_soggetto TEXT,

  consenso_marketing BOOLEAN NOT NULL DEFAULT false,
  consenso_profilazione BOOLEAN NOT NULL DEFAULT false,
  email_preferences JSONB,

  welcome_email_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON public.users (email);
CREATE INDEX idx_users_tipo_utente ON public.users (tipo_utente);
CREATE INDEX idx_users_codice_fiscale ON public.users (codice_fiscale)
  WHERE codice_fiscale IS NOT NULL;

CREATE TABLE public.user_business_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  ragione_sociale TEXT,
  partita_iva TEXT,
  pec TEXT,
  codice_sdi TEXT DEFAULT '0000000',
  iban TEXT,
  azienda_via TEXT,
  azienda_citta TEXT,
  azienda_provincia TEXT,
  azienda_cap TEXT,
  azienda_nazione TEXT DEFAULT 'IT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_addresses (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  via TEXT,
  citta TEXT,
  provincia TEXT,
  cap TEXT,
  localita TEXT,
  nazione TEXT DEFAULT 'IT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.professional_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  numero_albo TEXT,
  numero_autorizzazione_asl TEXT,
  specializzazioni TEXT[],
  documento_tipo TEXT,
  documento_numero TEXT,
  documento_comune_rilascio TEXT,
  codice_medico TEXT UNIQUE,
  codice_commerciale TEXT UNIQUE,
  codice_riferimento TEXT,
  medico_riferimento_id UUID REFERENCES public.users(id),
  binding_request_id UUID,
  dichiarazione_assenza_carichi_giudiziari BOOLEAN NOT NULL DEFAULT false,
  professional_signature_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prof_cred_codice_medico ON public.professional_credentials (codice_medico)
  WHERE codice_medico IS NOT NULL;
CREATE INDEX idx_prof_cred_riferimento_id ON public.professional_credentials (medico_riferimento_id)
  WHERE medico_riferimento_id IS NOT NULL;

CREATE TABLE public.professional_studios (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  nome TEXT,
  via TEXT,
  citta TEXT,
  provincia TEXT,
  cap TEXT,
  telefono TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_consents (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  CONSTRAINT one_active_consent_per_user UNIQUE (user_id)
);
