ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_slug TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_profile_slug ON public.users (profile_slug)
  WHERE profile_slug IS NOT NULL;

ALTER TABLE public.booking_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avail_own" ON public.booking_availability;
CREATE POLICY "avail_own" ON public.booking_availability
  FOR ALL USING (auth.uid() = professional_id);

DROP POLICY IF EXISTS "avail_clinic_read" ON public.booking_availability;
CREATE POLICY "avail_clinic_read" ON public.booking_availability
  FOR SELECT USING (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = booking_availability.company_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

ALTER TABLE public.booking_blocked_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_own" ON public.booking_blocked_slots;
CREATE POLICY "blocked_own" ON public.booking_blocked_slots
  FOR ALL USING (auth.uid() = professional_id);

ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_own" ON public.booking_settings;
CREATE POLICY "settings_own" ON public.booking_settings
  FOR ALL USING (auth.uid() = professional_id);

ALTER TABLE public.company_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_clinic" ON public.company_rooms;
CREATE POLICY "rooms_clinic" ON public.company_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = company_rooms.company_id
        AND user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'admin', 'staff')
    )
  );
