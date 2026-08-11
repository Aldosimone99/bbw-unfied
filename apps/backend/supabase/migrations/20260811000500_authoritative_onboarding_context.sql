-- The backend is the only application authorization boundary. These RPCs are
-- callable only with the service role used after the backend verifies the JWT.

CREATE OR REPLACE FUNCTION public.complete_account_onboarding(
  p_user_id UUID,
  p_account_type TEXT,
  p_organization_display_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
  v_company_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ONBOARDING_COMPLETION';
  END IF;

  IF p_account_type NOT IN ('personal', 'healthcare_professional', 'beauty_professional', 'organization', 'commercial') THEN
    RAISE EXCEPTION 'INVALID_ACCOUNT_TYPE';
  END IF;

  SELECT onboarding_status
    INTO v_status
    FROM public.users
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_NOT_FOUND';
  END IF;

  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'ONBOARDING_ALREADY_COMPLETED';
  END IF;

  IF p_account_type = 'organization' THEN
    IF nullif(btrim(p_organization_display_name), '') IS NULL THEN
      RAISE EXCEPTION 'ORGANIZATION_NAME_REQUIRED';
    END IF;

    INSERT INTO public.companies (name, clinic_display_name, created_by)
    VALUES (btrim(p_organization_display_name), btrim(p_organization_display_name), p_user_id)
    RETURNING id INTO v_company_id;

    INSERT INTO public.company_members (company_id, user_id, role, is_active)
    VALUES (v_company_id, p_user_id, 'owner', TRUE);
  END IF;

  UPDATE public.users
     SET requested_account_type = p_account_type,
         onboarding_status = 'completed',
         onboarding_completed_at = now(),
         updated_at = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('company_id', v_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_account_onboarding(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_account_onboarding(UUID, TEXT, TEXT) TO service_role;
