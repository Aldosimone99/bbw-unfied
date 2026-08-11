CREATE TABLE IF NOT EXISTS public.platform_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  allowed_roles TEXT[] DEFAULT '{"medico_estetico","estetista"}',
  description TEXT,
  description_male TEXT,
  description_female TEXT,
  image_male_path TEXT,
  image_female_path TEXT,
  insurance_included BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  duration INTEGER NOT NULL DEFAULT 30,
  price_cents INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  automatic_consents_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_treatments_category ON public.platform_treatments (category);
CREATE INDEX IF NOT EXISTS idx_platform_treatments_active ON public.platform_treatments (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.company_treatment_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform_treatment_id UUID NOT NULL REFERENCES public.platform_treatments(id),
  price_override_cents INTEGER CHECK (price_override_cents IS NULL OR price_override_cents >= 0),
  duration_override_min INTEGER CHECK (duration_override_min IS NULL OR duration_override_min > 0),
  points_override INTEGER CHECK (points_override IS NULL OR points_override >= 0),
  consent_template_id UUID REFERENCES public.consent_templates(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, platform_treatment_id)
);

CREATE INDEX IF NOT EXISTS idx_ctc_company ON public.company_treatment_catalog (company_id);
CREATE INDEX IF NOT EXISTS idx_ctc_treatment ON public.company_treatment_catalog (platform_treatment_id);

CREATE TABLE IF NOT EXISTS public.professional_catalog_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_catalog_id UUID REFERENCES public.company_treatment_catalog(id) ON DELETE CASCADE,
  platform_treatment_id UUID REFERENCES public.platform_treatments(id),
  price_override_cents INTEGER CHECK (price_override_cents IS NULL OR price_override_cents >= 0),
  duration_override_min INTEGER CHECK (duration_override_min IS NULL OR duration_override_min > 0),
  points_override INTEGER CHECK (points_override IS NULL OR points_override >= 0),
  consent_template_id UUID REFERENCES public.consent_templates(id),
  disclaimer_accepted BOOLEAN NOT NULL DEFAULT false,
  disclaimer_accepted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id, company_catalog_id),
  UNIQUE (professional_id, platform_treatment_id),
  CONSTRAINT pca_exactly_one_source CHECK (
    (company_catalog_id IS NOT NULL AND platform_treatment_id IS NULL)
    OR (company_catalog_id IS NULL AND platform_treatment_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pca_professional ON public.professional_catalog_assignments (professional_id);
CREATE INDEX IF NOT EXISTS idx_pca_company_catalog ON public.professional_catalog_assignments (company_catalog_id) WHERE company_catalog_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pca_public ON public.professional_catalog_assignments (professional_id) WHERE is_active = true AND is_public = true;

CREATE TABLE IF NOT EXISTS public.custom_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES public.users(id),
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  description TEXT,
  description_male TEXT,
  description_female TEXT,
  image_male_path TEXT,
  image_female_path TEXT,
  insurance_included BOOLEAN NOT NULL DEFAULT false,
  category TEXT,
  duration INTEGER NOT NULL DEFAULT 30,
  price_cents INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_services_professional ON public.custom_services (professional_id) WHERE professional_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_services_company ON public.custom_services (company_id) WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.professional_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  custom_service_id UUID NOT NULL REFERENCES public.custom_services(id),
  source_type TEXT NOT NULL DEFAULT 'custom',
  custom_price_cents INTEGER,
  points_override INTEGER,
  duration_override INTEGER,
  consent_template_id UUID REFERENCES public.consent_templates(id),
  disclaimer_accepted BOOLEAN NOT NULL DEFAULT false,
  disclaimer_accepted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pci_professional ON public.professional_catalog_items (professional_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_pci_custom_service ON public.professional_catalog_items (custom_service_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_pci_public ON public.professional_catalog_items (professional_id) WHERE is_active = true AND is_deleted = false AND is_public = true;

CREATE TABLE IF NOT EXISTS public.company_service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.custom_services(id),
  professional_id UUID REFERENCES public.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_csc_company ON public.company_service_catalog (company_id);

CREATE OR REPLACE VIEW public.professional_catalog_effective AS
SELECT
  pca.id AS assignment_id,
  pca.professional_id,
  pt.id AS platform_treatment_id,
  pt.slug,
  pt.name,
  pt.category,
  pt.allowed_roles,
  pt.insurance_included,
  COALESCE(pca.price_override_cents, ctc.price_override_cents, pt.price_cents) AS effective_price_cents,
  COALESCE(pca.duration_override_min, ctc.duration_override_min, pt.duration) AS effective_duration_min,
  COALESCE(pca.points_override, ctc.points_override, pt.points) AS effective_points,
  CASE WHEN pca.company_catalog_id IS NOT NULL THEN ctc.consent_template_id ELSE pca.consent_template_id END AS effective_consent_template_id,
  pca.company_catalog_id,
  pca.disclaimer_accepted,
  pca.is_active,
  pca.is_public
FROM public.professional_catalog_assignments pca
JOIN public.platform_treatments pt ON pt.id = COALESCE(
  (SELECT platform_treatment_id FROM public.company_treatment_catalog WHERE id = pca.company_catalog_id),
  pca.platform_treatment_id
)
LEFT JOIN public.company_treatment_catalog ctc ON ctc.id = pca.company_catalog_id;

-- RLS

ALTER TABLE public.platform_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_treatment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_catalog_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_treatments_select_all_active"
  ON public.platform_treatments FOR SELECT
  USING (true);

CREATE POLICY "company_treatment_catalog_select_company"
  ON public.company_treatment_catalog FOR SELECT
  USING (company_id = auth.uid() OR company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "company_treatment_catalog_insert_owner_admin"
  ON public.company_treatment_catalog FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "company_treatment_catalog_update_owner_admin"
  ON public.company_treatment_catalog FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "company_treatment_catalog_delete_owner_admin"
  ON public.company_treatment_catalog FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "professional_catalog_assignments_select_own"
  ON public.professional_catalog_assignments FOR SELECT
  USING (professional_id = auth.uid());

CREATE POLICY "professional_catalog_assignments_insert_own"
  ON public.professional_catalog_assignments FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "professional_catalog_assignments_update_own"
  ON public.professional_catalog_assignments FOR UPDATE
  USING (professional_id = auth.uid());

CREATE POLICY "professional_catalog_assignments_delete_own"
  ON public.professional_catalog_assignments FOR DELETE
  USING (professional_id = auth.uid());

CREATE POLICY "custom_services_select_own"
  ON public.custom_services FOR SELECT
  USING (professional_id = auth.uid() OR company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "custom_services_insert_own"
  ON public.custom_services FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "custom_services_update_own"
  ON public.custom_services FOR UPDATE
  USING (professional_id = auth.uid());

CREATE POLICY "custom_services_delete_own"
  ON public.custom_services FOR DELETE
  USING (professional_id = auth.uid());

CREATE POLICY "professional_catalog_items_select_own"
  ON public.professional_catalog_items FOR SELECT
  USING (professional_id = auth.uid());

CREATE POLICY "professional_catalog_items_insert_own"
  ON public.professional_catalog_items FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "professional_catalog_items_update_own"
  ON public.professional_catalog_items FOR UPDATE
  USING (professional_id = auth.uid());

CREATE POLICY "professional_catalog_items_delete_own"
  ON public.professional_catalog_items FOR DELETE
  USING (professional_id = auth.uid());

CREATE POLICY "company_service_catalog_select_company"
  ON public.company_service_catalog FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "company_service_catalog_insert_company"
  ON public.company_service_catalog FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "company_service_catalog_update_company"
  ON public.company_service_catalog FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "company_service_catalog_delete_company"
  ON public.company_service_catalog FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
