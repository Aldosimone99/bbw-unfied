-- ─────────────────────────────────────────────────────────────────────────────
-- 00 — Production Baseline Schema
-- ─────────────────────────────────────────────────────────────────────────────
-- This is the current production schema (old structure) loaded as a starting
-- point for local development. Transformation migrations (20260626_*) bring

CREATE SCHEMA IF NOT EXISTS app_private;
CREATE SCHEMA IF NOT EXISTS trash;

-- ─────────────────────────────────────────────────────────────────────────────
-- this schema to the new target architecture.
-- Generated from: prod-db/schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";


CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";


CREATE TYPE "public"."binding_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'detached'
);


CREATE TYPE "public"."contact_owner_role" AS ENUM (
    'medico',
    'estetista',
    'commerciale'
);


CREATE TYPE "public"."coupon_status" AS ENUM (
    'active',
    'used',
    'expired'
);


CREATE TYPE "public"."coupon_type" AS ENUM (
    'percentage',
    'fixed',
    'free_treatment'
);


CREATE TYPE "public"."credibility_audit_actor" AS ENUM (
    'SYSTEM',
    'ADMIN'
);


CREATE TYPE "public"."credibility_check_status" AS ENUM (
    'PENDING',
    'RUNNING',
    'DONE_GREEN',
    'DONE_YELLOW',
    'DONE_RED',
    'FAILED'
);


CREATE TYPE "public"."credibility_mention_source" AS ENUM (
    'NEWS',
    'BLOG',
    'FORUM',
    'SOCIAL',
    'OTHER'
);


CREATE TYPE "public"."document_type" AS ENUM (
    'albo',
    'asl',
    'qualifica',
    'visura',
    'scia',
    'identita',
    'polizza',
    'altro'
);


CREATE TYPE "public"."finance_status" AS ENUM (
    'pending',
    'authorized',
    'captured',
    'settled',
    'failed',
    'refunded',
    'chargeback',
    'on_hold',
    'pending_cash',
    'pending_crypto'
);


CREATE TYPE "public"."invite_status" AS ENUM (
    'pending',
    'sent',
    'active',
    'used',
    'expired',
    'cancelled'
);


CREATE TYPE "public"."invite_type" AS ENUM (
    'medico',
    'cliente',
    'estetista',
    'commerciale',
    'clinica'
);


CREATE TYPE "public"."otp_purpose" AS ENUM (
    'login',
    'registration',
    'consent'
);


CREATE TYPE "public"."professional_type" AS ENUM (
    'medico',
    'estetista',
    'clinica'
);


CREATE TYPE "public"."service_category" AS ENUM (
    'viso',
    'corpo',
    'consulto',
    'altro',
    'medicina_estetica',
    'dermatologia',
    'chirurgia_plastica',
    'tricologia_capelli',
    'odontoiatria_estetica',
    'nutrizione_benessere',
    'estetica_professionale_avanzata',
    'depilazione_definitiva'
);


CREATE TYPE "public"."soggetto_type" AS ENUM (
    'privato',
    'azienda'
);


CREATE TYPE "public"."subscription_plan" AS ENUM (
    'basic',
    'premium',
    'enterprise'
);


CREATE TYPE "public"."subscription_status" AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
    'PENDING'
);


CREATE TYPE "public"."treatment_status" AS ENUM (
    'scheduled',
    'awaiting_signature',
    'mancato',
    'completed',
    'cancelled'
);


CREATE TYPE "public"."user_type" AS ENUM (
    'admin',
    'cliente',
    'privato',
    'medico',
    'commerciale',
    'estetista',
    'clinica'
);


CREATE TYPE "public"."verification_status" AS ENUM (
    'pending',
    'in_review',
    'verified',
    'rejected',
    'expired',
    'uploaded'
);


CREATE OR REPLACE FUNCTION "app_private"."enforce_paid_treatment_contract_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_old_booking_id text;
  v_new_booking_id text;
  v_paid_booking_id text;
BEGIN
  IF tg_op = 'DELETE' THEN
    v_old_booking_id := nullif(old.booking_id::text, '');
    v_new_booking_id := NULL;
  ELSE
    v_old_booking_id := nullif(old.booking_id::text, '');
    v_new_booking_id := nullif(new.booking_id::text, '');
  END IF;

  IF v_old_booking_id IS NULL AND v_new_booking_id IS NULL THEN
    IF tg_op = 'DELETE' THEN
      RETURN old;
    END IF;
    RETURN new;
  END IF;

  SELECT fps.entity_id
  INTO v_paid_booking_id
  FROM public.finance_payment_sessions fps
  WHERE fps.entity_type = 'treatment'
    AND fps.status = 'settled'::finance_status
    AND fps.entity_id IN (
      coalesce(v_old_booking_id, '00000000-0000-0000-0000-000000000000'),
      coalesce(v_new_booking_id, '00000000-0000-0000-0000-000000000000')
    )
  ORDER BY CASE WHEN fps.entity_id = v_old_booking_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_paid_booking_id IS NULL THEN
    IF tg_op = 'DELETE' THEN
      RETURN old;
    END IF;
    RETURN new;
  END IF;

  IF tg_op = 'DELETE' THEN
    RAISE EXCEPTION 'PAID_TREATMENT_IMMUTABLE: paid treatments cannot be deleted'
      USING errcode = 'P0001',
            detail = jsonb_build_object(
              'bookingId', v_paid_booking_id,
              'attemptedFields', jsonb_build_array('delete')
            )::text;
  END IF;

  IF new.status::text = 'cancelled' AND old.status IS DISTINCT FROM new.status THEN
    RAISE EXCEPTION 'PAID_TREATMENT_IMMUTABLE: paid treatments cannot be cancelled'
      USING errcode = 'P0001',
            detail = jsonb_build_object(
              'bookingId', v_paid_booking_id,
              'attemptedFields', jsonb_build_array('status')
            )::text;
  END IF;

  IF new.user_id IS DISTINCT FROM old.user_id
    OR new.medico_id IS DISTINCT FROM old.medico_id
    OR new.company_id IS DISTINCT FROM old.company_id
    OR new.service_id IS DISTINCT FROM old.service_id
    OR new.treatment_name IS DISTINCT FROM old.treatment_name
    OR new.date IS DISTINCT FROM old.date
    OR new.duration IS DISTINCT FROM old.duration
    OR new.price IS DISTINCT FROM old.price
    OR new.points IS DISTINCT FROM old.points
    OR new.location IS DISTINCT FROM old.location
    OR new.booking_id IS DISTINCT FROM old.booking_id
  THEN
    RAISE EXCEPTION 'PAID_TREATMENT_IMMUTABLE: paid treatment contractual fields cannot be changed'
      USING errcode = 'P0001',
            detail = jsonb_build_object(
              'bookingId', v_paid_booking_id,
              'attemptedFields', jsonb_build_array(
                'user_id',
                'medico_id',
                'company_id',
                'service_id',
                'treatment_name',
                'date',
                'duration',
                'price',
                'points',
                'location',
                'booking_id'
              )
            )::text;
  END IF;

  RETURN new;
END;
$$;


CREATE OR REPLACE FUNCTION "app_private"."rls_is_admin_user"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.tipo_utente = 'admin'::public.user_type
  );
END;
$$;


CREATE OR REPLACE FUNCTION "public"."append_forensic_event"("p_chain_key" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_actor_company_id" "uuid", "p_action_type" "text", "p_subject_type" "text", "p_subject_id" "text", "p_payload" "jsonb", "p_ip_address" "text", "p_user_agent" "text", "p_device_fingerprint" "jsonb", "p_geolocation" "jsonb", "p_request_id" "text", "p_source" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_now timestamptz := now();
  v_prev_hash text;
  v_payload_hash text;
  v_event_hash text;
  v_event_id uuid;
begin
  if p_chain_key is null or length(trim(p_chain_key)) = 0 then
    raise exception 'chain_key is required';
  end if;
  if p_actor_role is null or length(trim(p_actor_role)) = 0 then
    raise exception 'actor_role is required';
  end if;
  if p_action_type is null or length(trim(p_action_type)) = 0 then
    raise exception 'action_type is required';
  end if;
  if p_subject_type is null or length(trim(p_subject_type)) = 0 then
    raise exception 'subject_type is required';
  end if;
  if p_subject_id is null or length(trim(p_subject_id)) = 0 then
    raise exception 'subject_id is required';
  end if;

  -- Lock chain head (create if missing)
  insert into public.forensic_chain_heads(chain_key, head_event_id, head_hash, updated_at)
  values (p_chain_key, null, null, v_now)
  on conflict (chain_key) do update
    set updated_at = excluded.updated_at;

  select head_hash into v_prev_hash
  from public.forensic_chain_heads
  where chain_key = p_chain_key
  for update;

  v_payload_hash := encode(digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');

  -- event hash includes prev hash to form a hash-chain
  v_event_hash := encode(
    digest(
      concat_ws(
        ':',
        v_payload_hash,
        coalesce(v_prev_hash, ''),
        coalesce(p_actor_id::text, ''),
        coalesce(p_actor_company_id::text, ''),
        p_actor_role,
        p_action_type,
        p_subject_type,
        p_subject_id,
        v_now::text
      )::bytea,
      'sha256'
    ),
    'hex'
  );

  insert into public.forensic_events (
    id,
    created_at,
    actor_id,
    actor_role,
    actor_company_id,
    action_type,
    subject_type,
    subject_id,
    payload,
    payload_hash,
    prev_hash,
    event_hash,
    ip_address,
    user_agent,
    device_fingerprint,
    geolocation,
    request_id,
    source
  )
  values (
    uuid_generate_v4(),
    v_now,
    p_actor_id,
    p_actor_role,
    p_actor_company_id,
    p_action_type,
    p_subject_type,
    p_subject_id,
    coalesce(p_payload, '{}'::jsonb),
    v_payload_hash,
    v_prev_hash,
    v_event_hash,
    p_ip_address,
    p_user_agent,
    p_device_fingerprint,
    p_geolocation,
    p_request_id,
    coalesce(nullif(trim(p_source), ''), 'api')
  )
  returning id into v_event_id;

  update public.forensic_chain_heads
  set head_event_id = v_event_id,
      head_hash = v_event_hash,
      updated_at = v_now
  where chain_key = p_chain_key;

  return v_event_id;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."apply_points_ledger_to_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE users
    SET updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."backfill_user_auth_links"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_count integer := 0;
begin
  insert into public.user_auth_links (auth_user_id, app_user_id)
  select au.id, u.id
  from auth.users au
  join public.users u on lower(u.email) = lower(au.email)
  left join public.user_auth_links l on l.auth_user_id = au.id
  where l.auth_user_id is null
  on conflict (auth_user_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_consent_tokens"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM consent_share_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_otps"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM otps WHERE expires_at < (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."company_rooms_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."current_app_user_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN (select ual.app_user_id
  from public.user_auth_links ual
  where ual.auth_user_id = auth.uid()
  limit 1);
END;
$$;


CREATE OR REPLACE FUNCTION "public"."email_suppressions_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."enforce_company_member_user_type"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  member_user_type public.user_type;
BEGIN
  SELECT u.tipo_utente
  INTO member_user_type
  FROM public.users u
  WHERE u.id = NEW.user_id;

  IF member_user_type IS NULL THEN
    RAISE EXCEPTION 'DATA_INTEGRITY: COMPANY_MEMBER_USER_NOT_FOUND (user_id=%)', NEW.user_id
      USING ERRCODE = '23514';
  END IF;

  IF member_user_type = 'commerciale'::public.user_type THEN
    RAISE EXCEPTION 'DATA_INTEGRITY: COMPANY_MEMBER_USER_TYPE_NOT_ALLOWED (user_id=% user_type=%)', NEW.user_id, member_user_type
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."forensic_forbid_update_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'FORBIDDEN: forensic tables are append-only';
end;
$$;


CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := 'INV-';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_active_users"() RETURNS TABLE("user_row" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT to_jsonb(u.*) AS user_row
  FROM public.users u
  WHERE NOT EXISTS (SELECT 1 FROM trash.users t WHERE t.user_id = u.id)
  ORDER BY u.created_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_company_coupons_trash"("p_actor_id" "uuid", "p_company_id" "uuid") RETURNS TABLE("coupon_row" "jsonb", "deleted_at" timestamp with time zone, "deleted_by" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT to_jsonb(tc) AS coupon_row, tc.deleted_at, tc.deleted_by
  FROM trash.coupons tc
  WHERE tc.company_id = p_company_id
    AND EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_company_id AND cm.user_id = p_actor_id AND cm.is_active = TRUE AND cm.role IN ('owner', 'admin'))
  ORDER BY tc.deleted_at DESC NULLS LAST;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_company_treatments_trash"("p_actor_id" "uuid", "p_company_id" "uuid") RETURNS TABLE("treatment_row" "jsonb", "deleted_at" timestamp with time zone, "deleted_by" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb((
      SELECT x FROM (
        SELECT
          tr.id,
          tr.user_id,
          tr.medico_id,
          tr.company_id,
          tr.service_id,
          tr.treatment_name,
          tr.description,
          tr.date,
          tr.duration,
          tr.price,
          tr.points,
          tr.type,
          tr.category,
          tr.location,
          tr.notes,
          tr.status,
          tr.consenso_informato_url,
          tr.etichetta_farmaco_url,
          tr.farmaco_lotto,
          tr.farmaco_scadenza,
          tr.completed_at,
          tr.created_at,
          tr.updated_at,
          tr.booking_id
      ) AS x
    )) AS treatment_row,
    tr.deleted_at,
    tr.deleted_by
  FROM trash.treatments tr
  WHERE tr.company_id = p_company_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.company_members cm
        WHERE cm.company_id = p_company_id
          AND cm.user_id = p_actor_id
          AND cm.is_active = TRUE
          AND cm.role IN ('owner', 'admin', 'staff', 'professional')
      )
      OR EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = p_company_id
          AND c.created_by = p_actor_id
      )
    )
  ORDER BY tr.deleted_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_coupons_trash"("p_actor_id" "uuid") RETURNS TABLE("coupon_row" "jsonb", "deleted_at" timestamp with time zone, "deleted_by" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT to_jsonb(tc) AS coupon_row, tc.deleted_at, tc.deleted_by
  FROM trash.coupons tc LEFT JOIN public.users u ON u.id = p_actor_id
  WHERE u.tipo_utente = 'admin' OR (tc.company_id IS NULL AND tc.medico_id = p_actor_id)
  ORDER BY tc.deleted_at DESC NULLS LAST;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_custom_services_trash"("p_medico_id" "uuid") RETURNS TABLE("service_row" "jsonb", "deleted_at" timestamp with time zone, "deleted_by" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb((
      SELECT x FROM (
        SELECT
          t.id,
          t.medico_id,
          t.name,
          t.description,
          t.category,
          t.duration,
          t.price,
          t.points,
          t.location,
          t.is_active,
          t.created_at,
          t.updated_at
      ) AS x
    )) AS service_row,
    t.deleted_at,
    t.deleted_by
  FROM trash.custom_services t
  WHERE t.medico_id = p_medico_id
  ORDER BY t.deleted_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_invites_trash"() RETURNS TABLE("id" "uuid", "code" character varying, "commerciale_id" "uuid", "type" "public"."invite_type", "email" character varying, "nome" character varying, "cognome" character varying, "telefono" character varying, "accept_token" "uuid", "status" "public"."invite_status", "used_by" "uuid", "used_at" timestamp with time zone, "expires_at" timestamp with time zone, "created_at" timestamp with time zone, "deleted_at" timestamp with time zone, "deleted_by" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    code,
    commerciale_id,
    type,
    email,
    nome,
    cognome,
    telefono,
    accept_token,
    status,
    used_by,
    used_at,
    expires_at,
    created_at,
    deleted_at,
    deleted_by
  FROM trash.invites
  ORDER BY deleted_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_treatments_trash"("p_medico_id" "uuid") RETURNS TABLE("treatment_row" "jsonb", "deleted_at" timestamp with time zone, "deleted_by" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb((
      SELECT x FROM (
        SELECT
          tr.id,
          tr.user_id,
          tr.medico_id,
          tr.company_id,
          tr.service_id,
          tr.treatment_name,
          tr.description,
          tr.date,
          tr.duration,
          tr.price,
          tr.points,
          tr.type,
          tr.category,
          tr.location,
          tr.notes,
          tr.status,
          tr.consenso_informato_url,
          tr.etichetta_farmaco_url,
          tr.farmaco_lotto,
          tr.farmaco_scadenza,
          tr.completed_at,
          tr.created_at,
          tr.updated_at,
          tr.booking_id
      ) AS x
    )) AS treatment_row,
    tr.deleted_at,
    tr.deleted_by
  FROM trash.treatments tr
  WHERE tr.medico_id = p_medico_id
    AND tr.company_id IS NULL
  ORDER BY tr.deleted_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_users_trash"() RETURNS TABLE("user_row" "jsonb", "deleted_at" timestamp with time zone, "deleted_by" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT to_jsonb(u.*) AS user_row, t.deleted_at, t.deleted_by
  FROM trash.users t
  JOIN public.users u ON u.id = t.user_id
  ORDER BY t.deleted_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_valid_consent_token"("p_token" character varying) RETURNS TABLE("id" "uuid", "token" character varying, "consent_id" "uuid", "professional_id" "uuid", "client_id" "uuid", "treatment_id" "uuid", "expires_at" timestamp with time zone, "created_at" timestamp with time zone, "used_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.token,
        t.consent_id,
        t.professional_id,
        t.client_id,
        t.treatment_id,
        t.expires_at,
        t.created_at,
        t.used_at
    FROM consent_share_tokens t
    WHERE t.token = p_token
      AND t.expires_at > NOW()
      AND t.used_at IS NULL;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."handle_auth_user_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_tipo text;
  v_is_admin boolean;
begin
  select u.tipo_utente::text
  into v_tipo
  from public.users u
  where u.email is not null and new.email is not null and lower(u.email) = lower(new.email)
  limit 1;

  v_is_admin := (v_tipo = 'admin');

  insert into public.profiles (id, email, role, is_admin)
  values (new.id, new.email, coalesce(v_tipo, 'user'), coalesce(v_is_admin, false))
  on conflict (id) do update set
    email = excluded.email,
    role = excluded.role,
    is_admin = excluded.is_admin;

  return new;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."handle_auth_user_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_app_user_id uuid;
  v_email text;
begin
  v_email := coalesce(new.email, old.email);
  if v_email is null then
    return new;
  end if;

  select u.id
  into v_app_user_id
  from public.users u
  where lower(u.email) = lower(v_email)
  limit 1;

  if v_app_user_id is null then
    return new;
  end if;

  insert into public.user_auth_links (auth_user_id, app_user_id)
  values (new.id, v_app_user_id)
  on conflict (auth_user_id) do update set app_user_id = excluded.app_user_id;

  return new;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."increment_gallery_views"("item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.gallery_items
      SET views = COALESCE(views, 0) + 1
    WHERE id = item_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."is_company_admin"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN (select exists(
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = public.current_app_user_id()
      and cm.is_active = true
      and cm.role in ('owner', 'admin')
  ));
END;
$$;


CREATE OR REPLACE FUNCTION "public"."is_company_member"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN (select exists(
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = public.current_app_user_id()
      and cm.is_active = true
  ));
END;
$$;


CREATE OR REPLACE FUNCTION "public"."is_user_trashed"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (SELECT EXISTS (SELECT 1 FROM trash.users t WHERE t.user_id = p_user_id));
END;
$$;


CREATE OR REPLACE FUNCTION "public"."legal_acceptances_forbid_update_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'FORBIDDEN: legal_acceptances is append-only';
end;
$$;


CREATE OR REPLACE FUNCTION "public"."move_contact_to_trash"("p_contact_id" "uuid", "p_deleted_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_row RECORD;
begin
  select * into v_row from public.contacts where id = p_contact_id;
  if not found then
    return false;
  end if;

  insert into public.contacts_trash (
    id, owner_id, owner_role, linked_user_id,
    nome, cognome, email, telefono, codice_fiscale, data_nascita,
    via, citta, provincia, cap, localita, note, source,
    created_at, updated_at,
    deleted_at, deleted_by
  ) values (
    v_row.id, v_row.owner_id, v_row.owner_role, v_row.linked_user_id,
    v_row.nome, v_row.cognome, v_row.email, v_row.telefono, v_row.codice_fiscale, v_row.data_nascita,
    v_row.via, v_row.citta, v_row.provincia, v_row.cap, v_row.localita, v_row.note, v_row.source,
    v_row.created_at, v_row.updated_at,
    now(), p_deleted_by
  )
  on conflict (id) do update set
    deleted_at = excluded.deleted_at,
    deleted_by = excluded.deleted_by;

  delete from public.contacts where id = p_contact_id;
  return true;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."move_coupon_to_trash"("p_coupon_id" "uuid", "p_deleted_by" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  c RECORD;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE id = p_coupon_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO trash.coupons (id, code, medico_id, cliente_id, company_id, type, value, description, media_url, min_purchase, max_uses, used_count, valid_from, valid_until, status, created_at, deleted_at, deleted_by)
  VALUES (c.id, c.code, c.medico_id, c.cliente_id, c.company_id, c.type, c.value, c.description, c.media_url, c.min_purchase, c.max_uses, c.used_count, c.valid_from, c.valid_until, c.status, c.created_at, NOW(), p_deleted_by)
  ON CONFLICT (id) DO UPDATE SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by;

  DELETE FROM public.coupons WHERE id = p_coupon_id;
  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."move_custom_service_to_trash"("p_service_id" "uuid", "p_deleted_by" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  svc RECORD;
BEGIN
  SELECT * INTO svc FROM public.custom_services WHERE id = p_service_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO trash.custom_services (
    id,
    medico_id,
    name,
    description,
    category,
    duration,
    price,
    points,
    location,
    is_active,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
  )
  VALUES (
    svc.id,
    svc.medico_id,
    svc.name,
    svc.description,
    svc.category,
    svc.duration,
    svc.price,
    svc.points,
    svc.location,
    svc.is_active,
    svc.created_at,
    svc.updated_at,
    NOW(),
    p_deleted_by
  )
  ON CONFLICT (id) DO UPDATE
      SET deleted_by = EXCLUDED.deleted_by;

  DELETE FROM public.custom_services WHERE id = p_service_id;

  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."move_invite_to_trash"("p_invite_id" "uuid", "p_deleted_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO trash.invites (
    id,
    code,
    commerciale_id,
    type,
    email,
    nome,
    cognome,
    telefono,
    accept_token,
    status,
    used_by,
    used_at,
    expires_at,
    created_at,
    deleted_at,
    deleted_by
  )
  SELECT
    i.id,
    i.code,
    i.commerciale_id,
    i.type,
    i.email,
    i.nome,
    i.cognome,
    i.telefono,
    i.accept_token,
    i.status,
    i.used_by,
    i.used_at,
    i.expires_at,
    i.created_at,
    NOW(),
    p_deleted_by
  FROM public.invites i
  WHERE i.id = p_invite_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM public.invites WHERE id = p_invite_id;

  RETURN true;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."move_treatment_to_trash"("p_treatment_id" "uuid", "p_deleted_by" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT * INTO t FROM public.treatments WHERE id = p_treatment_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO trash.treatments (
    id,
    user_id,
    medico_id,
    company_id,
    service_id,
    treatment_name,
    description,
    date,
    duration,
    price,
    points,
    type,
    category,
    location,
    notes,
    status,
    consenso_informato_url,
    etichetta_farmaco_url,
    farmaco_lotto,
    farmaco_scadenza,
    completed_at,
    created_at,
    updated_at,
    booking_id,
    deleted_at,
    deleted_by
  )
  VALUES (
    t.id,
    t.user_id,
    t.medico_id,
    t.company_id,
    t.service_id,
    t.treatment_name,
    t.description,
    t.date,
    t.duration,
    t.price,
    t.points,
    t.type,
    t.category,
    t.location,
    t.notes,
    t.status,
    t.consenso_informato_url,
    t.etichetta_farmaco_url,
    t.farmaco_lotto,
    t.farmaco_scadenza,
    t.completed_at,
    t.created_at,
    t.updated_at,
    t.booking_id,
    now(),
    p_deleted_by
  )
  ON CONFLICT (id) DO UPDATE
      SET medico_id = EXCLUDED.medico_id,
      company_id = EXCLUDED.company_id,
      service_id = EXCLUDED.service_id,
      treatment_name = EXCLUDED.treatment_name,
      description = EXCLUDED.description,
      date = EXCLUDED.date,
      duration = EXCLUDED.duration,
      price = EXCLUDED.price,
      points = EXCLUDED.points,
      type = EXCLUDED.type,
      category = EXCLUDED.category,
      location = EXCLUDED.location,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status,
      consenso_informato_url = EXCLUDED.consenso_informato_url,
      etichetta_farmaco_url = EXCLUDED.etichetta_farmaco_url,
      farmaco_lotto = EXCLUDED.farmaco_lotto,
      farmaco_scadenza = EXCLUDED.farmaco_scadenza,
      completed_at = EXCLUDED.completed_at,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      booking_id = EXCLUDED.booking_id,
      deleted_at = EXCLUDED.deleted_at,
      deleted_by = EXCLUDED.deleted_by;

  DELETE FROM public.treatments WHERE id = p_treatment_id;
  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."move_user_to_trash"("p_user_id" "uuid", "p_deleted_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN
    RETURN false;
  END IF;

  INSERT INTO trash.users (user_id, deleted_at, deleted_by)
  VALUES (p_user_id, NOW(), p_deleted_by)
  ON CONFLICT (user_id)
  DO UPDATE SET deleted_at = EXCLUDED.deleted_at, deleted_by = EXCLUDED.deleted_by;

  RETURN true;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."purge_company_coupons_trash"("p_actor_id" "uuid", "p_company_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE deleted_count integer := 0;
BEGIN
  WITH deleted AS (DELETE FROM trash.coupons tc WHERE tc.company_id = p_company_id AND EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_company_id AND cm.user_id = p_actor_id AND cm.is_active = TRUE AND cm.role IN ('owner', 'admin')) RETURNING 1)
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."purge_company_treatments_trash"("p_actor_id" "uuid", "p_company_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH deleted AS (
    DELETE FROM trash.treatments tr
    WHERE tr.company_id = p_company_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.company_members cm
          WHERE cm.company_id = p_company_id
            AND cm.user_id = p_actor_id
            AND cm.is_active = TRUE
            AND cm.role IN ('owner', 'admin', 'staff', 'professional')
        )
        OR EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = p_company_id
            AND c.created_by = p_actor_id
        )
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."purge_contacts_trash"("p_owner_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_count integer;
begin
  delete from public.contacts_trash where owner_id = p_owner_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."purge_coupons_trash"("p_actor_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE deleted_count integer := 0; actor_role user_type;
BEGIN
  SELECT tipo_utente INTO actor_role FROM public.users WHERE id = p_actor_id;
  WITH deleted AS (DELETE FROM trash.coupons tc WHERE actor_role = 'admin' OR (tc.company_id IS NULL AND tc.medico_id = p_actor_id) RETURNING 1)
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."purge_custom_services_trash"("p_medico_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM trash.custom_services WHERE medico_id = p_medico_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."purge_invites_trash"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ DECLARE deleted_count integer; BEGIN DELETE FROM trash.invites WHERE TRUE; GET DIAGNOSTICS deleted_count = ROW_COUNT; RETURN deleted_count; END; $$;


CREATE OR REPLACE FUNCTION "public"."purge_treatments_trash"("p_medico_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH deleted AS (
    DELETE FROM trash.treatments
    WHERE medico_id = p_medico_id
      AND company_id IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."purge_users_trash"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.users u
  WHERE EXISTS (SELECT 1 FROM trash.users t WHERE t.user_id = u.id);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."rekey_user_id"("old_id" "uuid", "new_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  old_row RECORD;
  tmp_email text;
  tmp_cf text;
begin
  if old_id is null or new_id is null then
    raise exception 'old_id and new_id are required';
  end if;
  if old_id = new_id then
    return;
  end if;

  select * into old_row from public.users where id = old_id;
  if not found then
    raise exception 'public.users row not found for old_id %', old_id;
  end if;

  if exists(select 1 from public.users where id = new_id) then
    raise exception 'new_id already exists in public.users: %', new_id;
  end if;

  -- Avoid unique collisions on email/codice_fiscale while we insert the new row.
  tmp_email := 'rekey+' || old_id::text || '@invalid.local';
  tmp_cf := upper(substr(md5(old_id::text), 1, 16));

  update public.users
    set email = tmp_email,
        codice_fiscale = tmp_cf
  where id = old_id;

  insert into public.users (
    id, nome, cognome, email, password, telefono, codice_fiscale, avatar,
    data_nascita, localita, via, citta, provincia, cap, tipo_utente, tipo_soggetto,
    ragione_sociale, partita_iva, pec, codice_sdi, consenso_marketing, consenso_profilazione,
    numero_albo, numero_autorizzazione_asl, studio_via, studio_citta, studio_provincia, studio_cap,
    codice_commerciale, codice_riferimento, codice_medico, medico_riferimento_id,
    binding_request_id, loyalty_points, subscription, subscription_plan, subscription_end,
    dichiarazione_assenza_carichi_giudiziari, welcome_email_sent_at, created_at, updated_at
  ) values (
    new_id,
    old_row.nome,
    old_row.cognome,
    old_row.email,
    old_row.password,
    old_row.telefono,
    old_row.codice_fiscale,
    old_row.avatar,
    old_row.data_nascita,
    old_row.localita,
    old_row.via,
    old_row.citta,
    old_row.provincia,
    old_row.cap,
    old_row.tipo_utente,
    old_row.tipo_soggetto,
    old_row.ragione_sociale,
    old_row.partita_iva,
    old_row.pec,
    old_row.codice_sdi,
    old_row.consenso_marketing,
    old_row.consenso_profilazione,
    old_row.numero_albo,
    old_row.numero_autorizzazione_asl,
    old_row.studio_via,
    old_row.studio_citta,
    old_row.studio_provincia,
    old_row.studio_cap,
    old_row.codice_commerciale,
    old_row.codice_riferimento,
    old_row.codice_medico,
    old_row.medico_riferimento_id,
    old_row.binding_request_id,
    old_row.loyalty_points,
    old_row.subscription,
    old_row.subscription_plan,
    old_row.subscription_end,
    old_row.dichiarazione_assenza_carichi_giudiziari,
    old_row.welcome_email_sent_at,
    old_row.created_at,
    old_row.updated_at
  );

  -- Update referencing tables
  update public.binding_requests set user_id = new_id where user_id = old_id;
  update public.binding_requests set medico_id = new_id where medico_id = old_id;
  update public.binding_requests set commerciale_id = new_id where commerciale_id = old_id;

  update public.booking_availability set medico_id = new_id where medico_id = old_id;
  update public.booking_blocked_slots set medico_id = new_id where medico_id = old_id;

  update public.bookings set cliente_id = new_id where cliente_id = old_id;
  update public.bookings set medico_id = new_id where medico_id = old_id;

  update public.companies set created_by = new_id where created_by = old_id;

  update public.company_clients set added_by = new_id where added_by = old_id;
  update public.company_clients set client_user_id = new_id where client_user_id = old_id;

  update public.company_contacts set shared_by = new_id where shared_by = old_id;

  update public.company_member_invites set accepted_by = new_id where accepted_by = old_id;
  update public.company_member_invites set invited_by = new_id where invited_by = old_id;

  update public.company_members set user_id = new_id where user_id = old_id;

  update public.consent_templates set owner_id = new_id where owner_id = old_id;

  update public.contacts set linked_user_id = new_id where linked_user_id = old_id;
  update public.contacts set owner_id = new_id where owner_id = old_id;

  update public.coupons set cliente_id = new_id where cliente_id = old_id;
  update public.coupons set medico_id = new_id where medico_id = old_id;

  update public.credibility_audit_events set actor_id = new_id where actor_id = old_id;
  update public.credibility_audit_events set operator_id = new_id where operator_id = old_id;

  update public.credibility_checks set operator_id = new_id where operator_id = old_id;
  update public.credibility_mentions set operator_id = new_id where operator_id = old_id;
  update public.credibility_reviews set operator_id = new_id where operator_id = old_id;
  update public.credibility_scores set operator_id = new_id where operator_id = old_id;

  update public.custom_services set medico_id = new_id where medico_id = old_id;

  update public.invites set commerciale_id = new_id where commerciale_id = old_id;
  update public.invites set used_by = new_id where used_by = old_id;

  update public.legal_consent_audit_logs set user_id = new_id where user_id = old_id;

  update public.otps set user_id = new_id where user_id = old_id;

  update public.points_ledger set created_by = new_id where created_by = old_id;
  update public.points_ledger set user_id = new_id where user_id = old_id;

  update public.professional_catalog_items set professional_id = new_id where professional_id = old_id;
  update public.professional_disclaimer_acceptances set professional_id = new_id where professional_id = old_id;
  update public.professional_offered_treatments set professional_id = new_id where professional_id = old_id;
  update public.professional_verifications set user_id = new_id where user_id = old_id;

  update public.referral_codes set user_id = new_id where user_id = old_id;

  update public.referrals set referred_id = new_id where referred_id = old_id;
  update public.referrals set referrer_id = new_id where referrer_id = old_id;

  update public.subscriptions set user_id = new_id where user_id = old_id;

  update trash.users set user_id = new_id where user_id = old_id;

  update public.treatments set medico_id = new_id where medico_id = old_id;
  update public.treatments set user_id = new_id where user_id = old_id;

  update public.user_auth_links set app_user_id = new_id where app_user_id = old_id;

  update public.wallet_transactions set user_id = new_id where user_id = old_id;
  update public.wallets set user_id = new_id where user_id = old_id;

  update public.users set medico_riferimento_id = new_id where medico_riferimento_id = old_id;

  delete from public.users where id = old_id;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."release_job_lock"("p_lock_key" "text", "p_locked_by" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_now timestamptz := now();
begin
  update public.job_locks
    set locked_until = v_now,
        updated_at = v_now
  where lock_key = trim(p_lock_key)
    and locked_by = trim(p_locked_by);
  return found;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."restore_company_coupon_from_trash"("p_coupon_id" "uuid", "p_actor_id" "uuid", "p_company_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE c RECORD;
BEGIN
  SELECT * INTO c FROM trash.coupons tc
  WHERE tc.id = p_coupon_id AND tc.company_id = p_company_id
    AND EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_company_id AND cm.user_id = p_actor_id AND cm.is_active = TRUE AND cm.role IN ('owner', 'admin'));
  IF NOT FOUND THEN RETURN FALSE; END IF;

  BEGIN
    INSERT INTO public.coupons (id, code, medico_id, cliente_id, company_id, type, value, description, media_url, min_purchase, max_uses, used_count, valid_from, valid_until, status, created_at)
    VALUES (c.id, c.code, c.medico_id, c.cliente_id, c.company_id, c.type, c.value, c.description, c.media_url, c.min_purchase, c.max_uses, c.used_count, c.valid_from, c.valid_until, c.status, c.created_at)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN RETURN FALSE;
  END;

  DELETE FROM trash.coupons WHERE id = c.id;
  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."restore_company_treatment_from_trash"("p_treatment_id" "uuid", "p_actor_id" "uuid", "p_company_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT * INTO t
  FROM trash.treatments tr
  WHERE tr.id = p_treatment_id
    AND tr.company_id = p_company_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.company_members cm
        WHERE cm.company_id = p_company_id
          AND cm.user_id = p_actor_id
          AND cm.is_active = TRUE
          AND cm.role IN ('owner', 'admin', 'staff', 'professional')
      )
      OR EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = p_company_id
          AND c.created_by = p_actor_id
      )
    );

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.treatments (
    id,
    user_id,
    medico_id,
    company_id,
    service_id,
    treatment_name,
    description,
    date,
    duration,
    price,
    points,
    type,
    category,
    location,
    notes,
    status,
    consenso_informato_url,
    etichetta_farmaco_url,
    farmaco_lotto,
    farmaco_scadenza,
    completed_at,
    created_at,
    updated_at,
    booking_id
  )
  VALUES (
    t.id,
    t.user_id,
    t.medico_id,
    t.company_id,
    t.service_id,
    t.treatment_name,
    t.description,
    t.date,
    t.duration,
    t.price,
    t.points,
    t.type,
    t.category,
    t.location,
    t.notes,
    t.status,
    t.consenso_informato_url,
    t.etichetta_farmaco_url,
    t.farmaco_lotto,
    t.farmaco_scadenza,
    t.completed_at,
    t.created_at,
    t.updated_at,
    t.booking_id
  )
  ON CONFLICT (id) DO UPDATE
      SET medico_id = EXCLUDED.medico_id,
      company_id = EXCLUDED.company_id,
      service_id = EXCLUDED.service_id,
      treatment_name = EXCLUDED.treatment_name,
      description = EXCLUDED.description,
      date = EXCLUDED.date,
      duration = EXCLUDED.duration,
      price = EXCLUDED.price,
      points = EXCLUDED.points,
      type = EXCLUDED.type,
      category = EXCLUDED.category,
      location = EXCLUDED.location,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status,
      consenso_informato_url = EXCLUDED.consenso_informato_url,
      etichetta_farmaco_url = EXCLUDED.etichetta_farmaco_url,
      farmaco_lotto = EXCLUDED.farmaco_lotto,
      farmaco_scadenza = EXCLUDED.farmaco_scadenza,
      completed_at = EXCLUDED.completed_at,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      booking_id = EXCLUDED.booking_id;

  DELETE FROM trash.treatments WHERE id = t.id;
  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."restore_contact_from_trash"("p_contact_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_row RECORD;
begin
  select * into v_row from public.contacts_trash where id = p_contact_id;
  if not found then
    return false;
  end if;

  insert into public.contacts (
    id, owner_id, owner_role, linked_user_id,
    nome, cognome, email, telefono, codice_fiscale, data_nascita,
    via, citta, provincia, cap, localita, note, source,
    created_at, updated_at
  ) values (
    v_row.id, v_row.owner_id, v_row.owner_role, v_row.linked_user_id,
    v_row.nome, v_row.cognome, v_row.email, v_row.telefono, v_row.codice_fiscale, v_row.data_nascita,
    v_row.via, v_row.citta, v_row.provincia, v_row.cap, v_row.localita, v_row.note, v_row.source,
    coalesce(v_row.created_at, now()),
    now()
  )
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    owner_role = excluded.owner_role,
    linked_user_id = excluded.linked_user_id,
    nome = excluded.nome,
    cognome = excluded.cognome,
    email = excluded.email,
    telefono = excluded.telefono,
    codice_fiscale = excluded.codice_fiscale,
    data_nascita = excluded.data_nascita,
    via = excluded.via,
    citta = excluded.citta,
    provincia = excluded.provincia,
    cap = excluded.cap,
    localita = excluded.localita,
    note = excluded.note,
    source = excluded.source,
    updated_at = excluded.updated_at;

  delete from public.contacts_trash where id = p_contact_id;
  return true;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."restore_coupon_from_trash"("p_coupon_id" "uuid", "p_actor_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  c RECORD;
  actor_role user_type;
BEGIN
  SELECT tipo_utente INTO actor_role FROM public.users WHERE id = p_actor_id;
  IF actor_role IS NULL THEN RETURN FALSE; END IF;

  SELECT * INTO c FROM trash.coupons tc
  WHERE tc.id = p_coupon_id
    AND (actor_role = 'admin' OR (tc.company_id IS NULL AND tc.medico_id = p_actor_id));
  IF NOT FOUND THEN RETURN FALSE; END IF;

  BEGIN
    INSERT INTO public.coupons (id, code, medico_id, cliente_id, company_id, type, value, description, media_url, min_purchase, max_uses, used_count, valid_from, valid_until, status, created_at)
    VALUES (c.id, c.code, c.medico_id, c.cliente_id, c.company_id, c.type, c.value, c.description, c.media_url, c.min_purchase, c.max_uses, c.used_count, c.valid_from, c.valid_until, c.status, c.created_at)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN RETURN FALSE;
  END;

  DELETE FROM trash.coupons WHERE id = c.id;
  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."restore_custom_service_from_trash"("p_service_id" "uuid", "p_medico_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  svc RECORD;
BEGIN
  SELECT * INTO svc FROM trash.custom_services WHERE id = p_service_id AND medico_id = p_medico_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.custom_services (
    id,
    medico_id,
    name,
    description,
    category,
    duration,
    price,
    points,
    location,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    svc.id,
    svc.medico_id,
    svc.name,
    svc.description,
    svc.category,
    svc.duration,
    svc.price,
    svc.points,
    svc.location,
    svc.is_active,
    svc.created_at,
    svc.updated_at
  )
  ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      duration = EXCLUDED.duration,
      price = EXCLUDED.price,
      points = EXCLUDED.points,
      location = EXCLUDED.location,
      is_active = EXCLUDED.is_active,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at;

  DELETE FROM trash.custom_services WHERE id = p_service_id;

  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."restore_invite_from_trash"("p_invite_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.invites (
    id,
    code,
    commerciale_id,
    type,
    email,
    nome,
    cognome,
    telefono,
    accept_token,
    status,
    used_by,
    used_at,
    expires_at,
    created_at
  )
  SELECT
    t.id,
    t.code,
    t.commerciale_id,
    t.type,
    t.email,
    t.nome,
    t.cognome,
    t.telefono,
    t.accept_token,
    t.status,
    t.used_by,
    t.used_at,
    t.expires_at,
    t.created_at
  FROM trash.invites t
  WHERE t.id = p_invite_id
  ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM trash.invites WHERE id = p_invite_id;
  RETURN true;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."restore_treatment_from_trash"("p_treatment_id" "uuid", "p_medico_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT * INTO t
  FROM trash.treatments
  WHERE id = p_treatment_id
    AND medico_id = p_medico_id
    AND company_id IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.treatments (
    id,
    user_id,
    medico_id,
    company_id,
    service_id,
    treatment_name,
    description,
    date,
    duration,
    price,
    points,
    type,
    category,
    location,
    notes,
    status,
    consenso_informato_url,
    etichetta_farmaco_url,
    farmaco_lotto,
    farmaco_scadenza,
    completed_at,
    created_at,
    updated_at,
    booking_id
  )
  VALUES (
    t.id,
    t.user_id,
    t.medico_id,
    t.company_id,
    t.service_id,
    t.treatment_name,
    t.description,
    t.date,
    t.duration,
    t.price,
    t.points,
    t.type,
    t.category,
    t.location,
    t.notes,
    t.status,
    t.consenso_informato_url,
    t.etichetta_farmaco_url,
    t.farmaco_lotto,
    t.farmaco_scadenza,
    t.completed_at,
    t.created_at,
    t.updated_at,
    t.booking_id
  )
  ON CONFLICT (id) DO UPDATE
      SET medico_id = EXCLUDED.medico_id,
      company_id = EXCLUDED.company_id,
      service_id = EXCLUDED.service_id,
      treatment_name = EXCLUDED.treatment_name,
      description = EXCLUDED.description,
      date = EXCLUDED.date,
      duration = EXCLUDED.duration,
      price = EXCLUDED.price,
      points = EXCLUDED.points,
      type = EXCLUDED.type,
      category = EXCLUDED.category,
      location = EXCLUDED.location,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status,
      consenso_informato_url = EXCLUDED.consenso_informato_url,
      etichetta_farmaco_url = EXCLUDED.etichetta_farmaco_url,
      farmaco_lotto = EXCLUDED.farmaco_lotto,
      farmaco_scadenza = EXCLUDED.farmaco_scadenza,
      completed_at = EXCLUDED.completed_at,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      booking_id = EXCLUDED.booking_id;

  DELETE FROM trash.treatments WHERE id = t.id;
  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."restore_user_from_trash"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM trash.users WHERE user_id = p_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."rls_is_admin_user"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN (SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tipo_utente = 'admin'::public.user_type
  ));
END;
$$;


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "cognome" character varying(255),
    "email" character varying(255),
    "password" character varying(255),
    "telefono" character varying(50),
    "codice_fiscale" character varying(16) NOT NULL,
    "avatar" "text",
    "data_nascita" "date",
    "localita" character varying(255),
    "via" character varying(255),
    "citta" character varying(255),
    "provincia" character varying(10),
    "cap" character varying(10),
    "tipo_utente" "public"."user_type" DEFAULT 'privato'::"public"."user_type" NOT NULL,
    "tipo_soggetto" "public"."soggetto_type",
    "ragione_sociale" character varying(255),
    "partita_iva" character varying(20),
    "pec" character varying(255),
    "codice_sdi" character varying(10),
    "consenso_marketing" boolean DEFAULT false,
    "consenso_profilazione" boolean DEFAULT false,
    "numero_albo" character varying(100),
    "numero_autorizzazione_asl" character varying(100),
    "studio_via" character varying(255),
    "studio_citta" character varying(255),
    "studio_provincia" character varying(10),
    "studio_cap" character varying(10),
    "codice_commerciale" character varying(50),
    "codice_riferimento" character varying(50),
    "codice_medico" character varying(50),
    "medico_riferimento_id" "uuid",
    "binding_request_id" "uuid",
    "loyalty_points" integer DEFAULT 0,
    "subscription" boolean DEFAULT false,
    "subscription_plan" "public"."subscription_plan",
    "subscription_end" timestamp with time zone,
    "dichiarazione_assenza_carichi_giudiziari" boolean DEFAULT false,
    "welcome_email_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "titolo" "text",
    "sesso" "text",
    "nazione" character varying,
    "specializzazioni" "text"[],
    "professional_signature_url" "text",
    "azienda_via" "text",
    "azienda_citta" "text",
    "azienda_provincia" "text",
    "azienda_cap" "text",
    "azienda_nazione" "text",
    "iban" character varying(34),
    "email_preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "documento_tipo" "text",
    "documento_numero" "text",
    "documento_comune_rilascio" "text"
);


CREATE OR REPLACE FUNCTION "public"."search_medico_estetista"("search_query" "text") RETURNS SETOF "public"."users"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.users
  WHERE tipo_utente IN ('medico', 'estetista')
    AND (search_query = ''
      OR extensions.unaccent(lower(coalesce(nome, ''))) LIKE '%' || extensions.unaccent(lower(search_query)) || '%'
      OR extensions.unaccent(lower(coalesce(cognome, ''))) LIKE '%' || extensions.unaccent(lower(search_query)) || '%'
      OR extensions.unaccent(lower(coalesce(codice_medico, ''))) LIKE '%' || extensions.unaccent(lower(search_query)) || '%'
      OR extensions.unaccent(lower(coalesce(citta, ''))) LIKE '%' || extensions.unaccent(lower(search_query)) || '%'
      OR extensions.unaccent(lower(coalesce(ragione_sociale, ''))) LIKE '%' || extensions.unaccent(lower(search_query)) || '%'
      OR extensions.unaccent(lower(coalesce(azienda_citta, ''))) LIKE '%' || extensions.unaccent(lower(search_query)) || '%')
  ORDER BY cognome, nome LIMIT 100;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."set_platform_logs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."set_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."set_updated_at_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."touch_board_listing_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."touch_user_deletion_request"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."trg_fn_company_commerciale_expires_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.expires_at := NEW.linked_at + INTERVAL '1 year';
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."try_acquire_job_lock"("p_lock_key" "text", "p_locked_by" "text", "p_ttl_seconds" integer DEFAULT 900) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_now timestamptz := now();
  v_ttl int := coalesce(p_ttl_seconds, 0);
  v_until timestamptz;
begin
  if p_lock_key is null or length(trim(p_lock_key)) = 0 then
    raise exception 'lock_key is required';
  end if;
  if p_locked_by is null or length(trim(p_locked_by)) = 0 then
    raise exception 'locked_by is required';
  end if;
  if v_ttl <= 0 then
    v_ttl := 900;
  end if;
  v_until := v_now + make_interval(secs => v_ttl);

  insert into public.job_locks(lock_key, locked_until, locked_by, updated_at)
  values (trim(p_lock_key), v_until, trim(p_locked_by), v_now)
  on conflict (lock_key) do update
    set locked_until = excluded.locked_until,
        locked_by = excluded.locked_by,
        updated_at = excluded.updated_at
  where public.job_locks.locked_until < v_now;

  return found;
end;
$$;


CREATE OR REPLACE FUNCTION "public"."update_email_audit_log_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."wallet_apply_transaction"("p_user_id" "uuid", "p_type" "text", "p_amount" numeric, "p_description" "text", "p_reference_id" "text" DEFAULT NULL::"text", "p_reference_type" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'completed'::"text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_wallet              RECORD;
    v_new_balance         numeric;
    v_new_pending_balance numeric;
    v_new_total_earned    numeric;
    v_new_total_spent     numeric;
    v_is_credit           boolean;
    v_tx                  RECORD;
BEGIN
    v_is_credit := p_type IN ('credit', 'refund', 'bonus', 'points_conversion');

    INSERT INTO public.wallets (user_id, currency)
    VALUES (p_user_id, 'EUR')
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    v_new_balance         := COALESCE(v_wallet.balance, 0);
    v_new_pending_balance := COALESCE(v_wallet.pending_balance, 0);
    v_new_total_earned    := COALESCE(v_wallet.total_earned, 0);
    v_new_total_spent     := COALESCE(v_wallet.total_spent, 0);

    IF p_status = 'completed' THEN
        IF v_is_credit THEN
            v_new_balance      := v_new_balance + p_amount;
            v_new_total_earned := v_new_total_earned + p_amount;
        ELSE
            IF v_new_balance < p_amount THEN
                RAISE EXCEPTION 'INSUFFICIENT_FUNDS' USING ERRCODE = 'P0001';
            END IF;
            v_new_balance     := v_new_balance - p_amount;
            v_new_total_spent := v_new_total_spent + p_amount;
        END IF;
    ELSIF p_status = 'pending' THEN
        IF NOT v_is_credit THEN
            v_new_pending_balance := v_new_pending_balance + p_amount;
        END IF;
    END IF;

    UPDATE public.wallets
    SET
        balance         = v_new_balance,
        pending_balance = v_new_pending_balance,
        total_earned    = v_new_total_earned,
        total_spent     = v_new_total_spent,
        updated_at      = now()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    INSERT INTO public.wallet_transactions (
        wallet_id,
        user_id,
        type,
        amount,
        description,
        reference_id,
        reference_type,
        status,
        balance_after,
        expires_at,
        completed_at
    )
    VALUES (
        v_wallet.id,
        p_user_id,
        p_type,
        p_amount,
        p_description,
        p_reference_id,
        p_reference_type,
        p_status,
        v_new_balance,
        p_expires_at,
        CASE WHEN p_status = 'completed' THEN now() ELSE NULL END
    )
    RETURNING * INTO v_tx;

    RETURN jsonb_build_object(
        'wallet',      to_jsonb(v_wallet),
        'transaction', to_jsonb(v_tx)
    );
END;
$$;


CREATE OR REPLACE FUNCTION "public"."wallet_expire_bonus_credits"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_rec record;
  v_count integer := 0;
BEGIN
  FOR v_rec IN
    SELECT id, user_id, amount
    FROM public.wallet_transactions
    WHERE type = 'bonus'
      AND status = 'completed'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.wallet_transactions
      SET status = 'expired'
    WHERE id = v_rec.id;

    BEGIN
      PERFORM public.wallet_apply_transaction(
        p_user_id := v_rec.user_id,
        p_type := 'debit',
        p_amount := LEAST(
          v_rec.amount,
          (SELECT balance FROM public.wallets WHERE user_id = v_rec.user_id)
        ),
        p_description := 'Scadenza credito bonus',
        p_reference_id := v_rec.id::text,
        p_reference_type := 'promotion',
        p_status := 'completed'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'wallet_expire_bonus_credits: failed debit for tx % user %: %',
        v_rec.id, v_rec.user_id, SQLERRM;
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


CREATE TABLE IF NOT EXISTS "public"."backfill_review" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "assigned_company_id" "uuid",
    "candidate_ids" "uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."binding_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "medico_id" "uuid",
    "commerciale_id" "uuid",
    "status" "public"."binding_status" DEFAULT 'pending'::"public"."binding_status" NOT NULL,
    "request_date" timestamp with time zone DEFAULT "now"(),
    "response_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."board_listing_quotas" (
    "user_id" "uuid" NOT NULL,
    "free_listings_used" integer DEFAULT 0 NOT NULL,
    "last_reset_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."board_listing_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "reporter_user_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "board_listing_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."board_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "price" numeric(10,2),
    "location" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "photos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending_approval'::"text" NOT NULL,
    "is_premium_only" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejected_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "board_listings_status_check" CHECK (("status" = ANY (ARRAY['pending_approval'::"text", 'active'::"text", 'expired'::"text", 'rejected'::"text", 'reported'::"text", 'deleted'::"text"]))),
    CONSTRAINT "board_listings_type_check" CHECK (("type" = ANY (ARRAY['lavoro_offerta'::"text", 'lavoro_ricerca'::"text", 'macchinario_usato'::"text", 'macchinario_nuovo'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."booking_availability" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid"
);


CREATE TABLE IF NOT EXISTS "public"."booking_blocked_slots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid"
);


CREATE TABLE IF NOT EXISTS "public"."booking_notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "recipient_email" "text",
    "due_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "email_message_id" "text",
    "internal_message_id" "uuid",
    "claimed_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "last_error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_notification_deliveries_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['visit_reminder'::"text", 'attendance_confirmation'::"text", 'review_request'::"text", 'next_visit_invite'::"text"]))),
    CONSTRAINT "booking_notification_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."booking_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "online_booking_enabled" boolean DEFAULT false,
    "first_slot" "text" DEFAULT 'domani'::"text",
    "last_slot" "text" DEFAULT '12 settimane'::"text",
    "conferma_prenotazione" boolean DEFAULT false,
    "promemoria_visita" boolean DEFAULT false,
    "conferma_presenza" boolean DEFAULT false,
    "richiesta_recensione" boolean DEFAULT false,
    "invito_prossima_visita" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "service_name" character varying(255) NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "duration" integer NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "notes" "text",
    "price" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "drug_label_url" "text",
    "consent_status" character varying(50) DEFAULT 'pending'::character varying,
    "consent_file_url" "text",
    "points_awarded" integer DEFAULT 0,
    "company_id" "uuid",
    "room_id" "uuid",
    "points" integer,
    CONSTRAINT "bookings_points_nonnegative" CHECK ((("points" IS NULL) OR ("points" >= 0)))
);


CREATE TABLE IF NOT EXISTS "public"."commerciale_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commerciale_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commerciale_rewards_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'expired'::"text", 'on_hold'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."commerciale_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reward_per_client" numeric(10,2) DEFAULT 10 NOT NULL,
    "reward_duration_months" integer DEFAULT 12 NOT NULL,
    "contract_start_date" timestamp with time zone,
    "contract_end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "vat_number" "text",
    "email" "text",
    "phone" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "codice_clinica" character varying(50),
    "clinic_display_name" "text",
    "clinic_via" "text",
    "clinic_citta" "text",
    "clinic_provincia" "text",
    "clinic_cap" "text",
    "clinic_nazione" "text",
    "clinic_specializations" "text"[],
    "legal_via" "text",
    "legal_citta" "text",
    "legal_provincia" "text",
    "legal_cap" "text",
    "legal_nazione" "text",
    "paypal_email" "text",
    "stripe_email" "text",
    "clinic_description" "text",
    "iban" character varying(34),
    "loyalty_program_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "loyalty_program_feature_enabled" boolean DEFAULT false NOT NULL,
    "loyalty_plan_availability" "jsonb",
    "loyalty_activation_expires_at" timestamp with time zone
);


CREATE TABLE IF NOT EXISTS "public"."company_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "client_user_id" "uuid" NOT NULL,
    "added_by" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ownership_type" "text" DEFAULT 'professional'::"text" NOT NULL,
    "referred_by" "uuid",
    CONSTRAINT "company_clients_ownership_type_check" CHECK (("ownership_type" = ANY (ARRAY['company'::"text", 'professional'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."company_commerciale_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "commerciale_id" "uuid" NOT NULL,
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '1 year'::interval) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."company_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "shared_by" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."company_member_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nome" "text",
    "cognome" "text",
    "user_id" "uuid",
    CONSTRAINT "company_member_invites_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'medical_director'::"text", 'professional'::"text", 'staff'::"text", 'medico'::"text", 'estetista'::"text"]))),
    CONSTRAINT "company_member_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text", 'expired'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."company_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'medical_director'::"text", 'professional'::"text", 'staff'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."company_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "professional_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "company_rooms_name_not_blank" CHECK (("length"("btrim"("name")) > 0))
);


CREATE TABLE IF NOT EXISTS "public"."company_service_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "professional_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consent_template_id" "uuid"
);


CREATE TABLE IF NOT EXISTS "public"."company_service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "direction" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "responded_at" timestamp with time zone,
    "responded_by" "uuid",
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_service_requests_direction_check" CHECK (("direction" = ANY (ARRAY['owner_to_professional'::"text", 'professional_to_owner'::"text"]))),
    CONSTRAINT "company_service_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'revoked'::"text", 'expired'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."consent_audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "consent_id" "uuid" NOT NULL,
    "version_id" "uuid",
    "signature_id" "uuid",
    "actor_id" "uuid",
    "actor_role" "text" NOT NULL,
    "actor_name" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "previous_status" "text",
    "new_status" "text",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."consent_document_versions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "consent_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "content_html" "text" DEFAULT ''::"text" NOT NULL,
    "content_hash" "text" NOT NULL,
    "header_included" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changes_summary" "text"
);


CREATE TABLE IF NOT EXISTS "public"."consent_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "template_id" "uuid",
    "treatment_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "current_version_id" "uuid",
    "content_hash" "text",
    "draft_created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "professional_signed_at" timestamp with time zone,
    "client_signed_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "revoked_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clinic_signed_at" timestamp with time zone
);


CREATE TABLE IF NOT EXISTS "public"."consent_share_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "token" character varying(255) NOT NULL,
    "consent_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "treatment_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone,
    "used_ip" character varying(45),
    "used_user_agent" "text"
);


CREATE TABLE IF NOT EXISTS "public"."consent_signatures" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "consent_id" "uuid" NOT NULL,
    "version_id" "uuid",
    "signer_id" "uuid",
    "signer_role" "text" NOT NULL,
    "signer_name" "text" NOT NULL,
    "signer_email" "text" NOT NULL,
    "method" "text" NOT NULL,
    "signature_image_data" "text",
    "otp_reference" "text",
    "otp_verified_at" timestamp with time zone,
    "attestation_text" "text",
    "scanned_document_url" "text",
    "signed_at" timestamp with time zone NOT NULL,
    "ip_address" "text" NOT NULL,
    "user_agent" "text" NOT NULL,
    "device_fingerprint" "jsonb",
    "geolocation" "jsonb",
    "document_hash" "text" NOT NULL,
    "signature_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "consent_signatures_signer_role_check" CHECK (("signer_role" = ANY (ARRAY['doctor'::"text", 'clinic'::"text", 'client'::"text"])))
);


CREATE OR REPLACE VIEW "public"."consent_signatures_unanchored" WITH ("security_invoker"='true') AS
 SELECT "id",
    "consent_id",
    "version_id",
    "signature_hash",
    "signer_role",
    "created_at"
   FROM "public"."consent_signatures" "s"
  WHERE (("signature_hash" IS NOT NULL) AND ("signer_role" = ANY (ARRAY['client'::"text", 'professional'::"text"])) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."consent_audit_logs" "l"
          WHERE (("l"."event_type" = 'CONSENT_ANCHORED'::"text") AND ("l"."signature_id" = "s"."id"))))));


CREATE TABLE IF NOT EXISTS "public"."consent_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "owner_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "treatment_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "content_html" "text" DEFAULT ''::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "disclaimer_accepted" boolean DEFAULT false NOT NULL,
    "disclaimer_accepted_at" timestamp with time zone,
    "company_id" "uuid",
    CONSTRAINT "consent_templates_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['medico'::"text", 'estetista'::"text", 'clinica'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "owner_role" "public"."contact_owner_role" NOT NULL,
    "linked_user_id" "uuid",
    "nome" character varying(255) NOT NULL,
    "cognome" character varying(255) NOT NULL,
    "email" character varying(255),
    "telefono" character varying(50),
    "codice_fiscale" character varying(16),
    "data_nascita" "date",
    "via" character varying(255),
    "citta" character varying(255),
    "provincia" character varying(10),
    "cap" character varying(10),
    "localita" character varying(255),
    "note" "text",
    "source" character varying(50) DEFAULT 'manual'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."contacts_trash" (
    "id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "owner_role" "public"."contact_owner_role" NOT NULL,
    "linked_user_id" "uuid",
    "nome" character varying,
    "cognome" character varying,
    "email" character varying,
    "telefono" character varying,
    "codice_fiscale" character varying,
    "data_nascita" "date",
    "via" character varying,
    "citta" character varying,
    "provincia" character varying,
    "cap" character varying,
    "localita" character varying,
    "note" "text",
    "source" character varying,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by" "uuid"
);


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "type" "public"."coupon_type" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "description" "text",
    "min_purchase" numeric(10,2),
    "max_uses" integer,
    "used_count" integer DEFAULT 0,
    "valid_from" timestamp with time zone NOT NULL,
    "valid_until" timestamp with time zone NOT NULL,
    "status" "public"."coupon_status" DEFAULT 'active'::"public"."coupon_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "target_entity_type" "text",
    "target_entity_id" "text",
    "media_url" "text",
    "company_id" "uuid",
    "premium_tier" "text",
    CONSTRAINT "coupons_premium_tier_chk" CHECK (("premium_tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text"]))),
    CONSTRAINT "coupons_scope_check" CHECK (("scope" = ANY (ARRAY['all'::"text", 'premium'::"text", 'treatment'::"text"]))),
    CONSTRAINT "coupons_target_entity_type_check" CHECK (("target_entity_type" = ANY (ARRAY['premium'::"text", 'treatment'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."credibility_audit_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "check_id" "uuid",
    "event_type" character varying(100) NOT NULL,
    "actor_type" "public"."credibility_audit_actor" NOT NULL,
    "actor_id" "uuid",
    "payload_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."credibility_checks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" "public"."credibility_check_status" DEFAULT 'PENDING'::"public"."credibility_check_status" NOT NULL,
    "progress_percent" integer DEFAULT 0,
    "last_step" character varying(255),
    "summary_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."credibility_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_path" "text",
    "file_hash" "text",
    "file_size" bigint,
    "mime_type" "text",
    "verification_status" "text" DEFAULT 'pending'::"text",
    "verification_details" "jsonb",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credibility_documents_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text", 'expired'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."credibility_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "issue_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text",
    "description" "text",
    "status" "text" DEFAULT 'open'::"text",
    "resolution_details" "jsonb",
    "detected_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credibility_issues_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "credibility_issues_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'investigating'::"text", 'resolved'::"text", 'archived'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."credibility_mentions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "check_id" "uuid" NOT NULL,
    "source_type" "public"."credibility_mention_source" NOT NULL,
    "title" character varying(500) NOT NULL,
    "snippet" "text",
    "url" "text" NOT NULL,
    "domain" character varying(255),
    "published_at" timestamp with time zone,
    "risk_score" integer DEFAULT 0,
    "reasons" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."credibility_reviews" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "check_id" "uuid" NOT NULL,
    "source" character varying(255) NOT NULL,
    "url" "text",
    "author" character varying(255),
    "rating" numeric(3,2),
    "text" "text",
    "reviewed_at" timestamp with time zone,
    "sentiment_label" character varying(50),
    "sentiment_score" numeric(5,4),
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."credibility_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "check_id" "uuid" NOT NULL,
    "total_score" integer NOT NULL,
    "breakdown" "jsonb",
    "reason_codes" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."custom_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "medico_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "category" "public"."service_category" DEFAULT 'altro'::"public"."service_category" NOT NULL,
    "duration" integer,
    "price" numeric(10,2) NOT NULL,
    "points" integer DEFAULT 0,
    "location" character varying(255),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description_male" "text",
    "description_female" "text",
    "image_male_path" "text",
    "image_female_path" "text",
    "insurance_included" boolean DEFAULT false NOT NULL,
    "company_id" "uuid",
    "source_service_id" "uuid",
    "contributed_by" "uuid",
    CONSTRAINT "chk_custom_services_owner" CHECK (((("medico_id" IS NOT NULL) AND ("company_id" IS NULL)) OR (("medico_id" IS NULL) AND ("company_id" IS NOT NULL))))
);


CREATE TABLE IF NOT EXISTS "public"."editorial_articles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trend_cluster_id" "uuid" NOT NULL,
    "topic" "text" NOT NULL,
    "headline" "text" NOT NULL,
    "dek" "text",
    "body_markdown" "text" NOT NULL,
    "language" "text" DEFAULT 'it'::"text" NOT NULL,
    "tone" "text" DEFAULT 'professional'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "source_refs_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "generation_meta_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "publish_slug" "text",
    "hero_excerpt" "text",
    "cover_image_url" "text",
    "site_priority" numeric(6,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "editorial_articles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'scheduled'::"text", 'published'::"text", 'failed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."editorial_audit_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "actor_user_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."editorial_homepage_slots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "target_scope" "text" NOT NULL,
    "rank_weight" numeric(7,2) DEFAULT 0 NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "editorial_homepage_slots_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text"]))),
    CONSTRAINT "editorial_homepage_slots_target_scope_check" CHECK (("target_scope" = ANY (ARRAY['global'::"text", 'privato'::"text", 'medico'::"text", 'estetista'::"text", 'commerciale'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."editorial_job_heartbeats" (
    "job_key" "text" NOT NULL,
    "last_run_at" timestamp with time zone NOT NULL,
    "last_status" "text" NOT NULL,
    "details_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "editorial_job_heartbeats_last_status_check" CHECK (("last_status" = ANY (ARRAY['success'::"text", 'skipped'::"text", 'error'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."editorial_publications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "external_id" "text",
    "error_message" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_url" "text",
    CONSTRAINT "editorial_publications_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'queued'::"text", 'published'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."editorial_user_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "article_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "event_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "editorial_user_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['impression'::"text", 'open'::"text", 'read'::"text", 'click'::"text", 'save'::"text", 'dismiss'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."editorial_user_preferences" (
    "user_id" "uuid" NOT NULL,
    "topics" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "channels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "last_digest_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."email_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invite_id" "uuid",
    "triggered_by_user_id" "uuid",
    "message_id" "text",
    "provider" "text" NOT NULL,
    "provider_message_id" "text",
    "sender_email" "text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "recipient_phone" "text",
    "reply_to" "text",
    "subject" "text" NOT NULL,
    "body_html" "text",
    "body_text" "text",
    "attachments" "jsonb",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "bounce_type" "text",
    "bounce_subtype" "text",
    "bounce_diagnostic_code" "text",
    "bounce_reason" "text",
    "queued_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "first_opened_at" timestamp with time zone,
    "first_click_at" timestamp with time zone,
    "bounced_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "open_count" integer DEFAULT 0,
    "click_count" integer DEFAULT 0,
    "retry_count" integer DEFAULT 0,
    "fallback_triggered" boolean DEFAULT false,
    "fallback_provider" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_audit_log_provider_check" CHECK (("provider" = ANY (ARRAY['ses'::"text", 'resend'::"text", 'smtp_register'::"text", 'smtp_fallback'::"text", 'mailtrap'::"text", 'simulated'::"text"]))),
    CONSTRAINT "email_audit_log_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivered'::"text", 'opened'::"text", 'clicked'::"text", 'bounced'::"text", 'failed'::"text", 'complained'::"text", 'accepted'::"text", 'suppressed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."email_domain_blacklist" (
    "domain" "text" NOT NULL,
    "first_bounce_at" timestamp with time zone DEFAULT "now"(),
    "last_bounce_at" timestamp with time zone DEFAULT "now"(),
    "bounce_count" integer DEFAULT 1,
    "force_provider" "text" DEFAULT 'smtp_register'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_domain_blacklist_force_provider_check" CHECK (("force_provider" = ANY (ARRAY['smtp_register'::"text", 'smtp_fallback'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."email_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audit_log_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_source" "text",
    "event_data" "jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivery_attempted'::"text", 'delivered'::"text", 'opened'::"text", 'clicked'::"text", 'bounced'::"text", 'complained'::"text", 'fallback_triggered'::"text", 'retry_scheduled'::"text", 'retry_succeeded'::"text", 'retry_failed'::"text", 'accepted'::"text", 'forwarded'::"text", 'failed'::"text", 'suppressed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."email_forwards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audit_log_id" "uuid" NOT NULL,
    "forwarded_by_user_id" "uuid",
    "forward_channel" "text" NOT NULL,
    "forward_to" "text" NOT NULL,
    "forward_message_id" "text",
    "forward_status" "text" DEFAULT 'pending'::"text",
    "forward_error" "text",
    "forwarded_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_forwards_forward_channel_check" CHECK (("forward_channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "email_forwards_forward_status_check" CHECK (("forward_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."email_suppressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "source" "text" NOT NULL,
    "diagnostic" "text",
    "bounce_type" "text",
    "bounced_at" timestamp with time zone,
    "source_message_id" "text",
    "unsuppressed_at" timestamp with time zone,
    "unsuppressed_by" "uuid",
    "unsuppressed_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_suppressions_reason_check" CHECK (("reason" = ANY (ARRAY['hard_bounce'::"text", 'soft_bounce'::"text", 'complaint'::"text", 'manual'::"text", 'invalid_address'::"text"]))),
    CONSTRAINT "email_suppressions_source_check" CHECK (("source" = ANY (ARRAY['imap_dsn'::"text", 'resend_webhook'::"text", 'ses_webhook'::"text", 'admin_manual'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."event_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip" "text"
);


CREATE TABLE IF NOT EXISTS "public"."finance_bonus_reimbursement_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "month" "text" NOT NULL,
    "total_amount_cents" integer NOT NULL,
    "payout_item_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "finance_bonus_reimbursement_batches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'invoiced'::"text", 'paid'::"text"]))),
    CONSTRAINT "finance_bonus_reimbursement_batches_total_amount_cents_check" CHECK (("total_amount_cents" > 0))
);


CREATE TABLE IF NOT EXISTS "public"."finance_installment_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "installment_model" "text" NOT NULL,
    "total_installments" integer NOT NULL,
    "completed_installments" integer DEFAULT 0 NOT NULL,
    "installment_amount_cents" integer NOT NULL,
    "status" "text" NOT NULL,
    "provider_plan_ref" "text",
    "next_due_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_installment_plans_completed_installments_check" CHECK (("completed_installments" >= 0)),
    CONSTRAINT "finance_installment_plans_installment_amount_cents_check" CHECK (("installment_amount_cents" > 0)),
    CONSTRAINT "finance_installment_plans_installment_model_check" CHECK (("installment_model" = ANY (ARRAY['stripe_subscription'::"text", 'paypal_pay_later'::"text", 'paypal_subscription'::"text"]))),
    CONSTRAINT "finance_installment_plans_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'paypal'::"text"]))),
    CONSTRAINT "finance_installment_plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text", 'on_hold'::"text"]))),
    CONSTRAINT "finance_installment_plans_total_installments_check" CHECK (("total_installments" > 0))
);


CREATE TABLE IF NOT EXISTS "public"."finance_invoice_jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "status" "text" NOT NULL,
    "external_ref" "text",
    "xml_payload" "text",
    "callback_payload" "jsonb",
    "last_error" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "next_retry_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_invoice_jobs_retry_count_check" CHECK (("retry_count" >= 0)),
    CONSTRAINT "finance_invoice_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text", 'error'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."finance_ledger_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "actor_role" "text",
    "entry_type" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" character(3) DEFAULT 'EUR'::"bpchar" NOT NULL,
    "reference_type" "text",
    "reference_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_ledger_entries_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['admin'::"text", 'cliente'::"text", 'medico'::"text", 'estetista'::"text", 'commerciale'::"text", 'platform'::"text"]))),
    CONSTRAINT "finance_ledger_entries_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "finance_ledger_entries_currency_check" CHECK (("currency" = 'EUR'::"bpchar")),
    CONSTRAINT "finance_ledger_entries_direction_check" CHECK (("direction" = ANY (ARRAY['in'::"text", 'out'::"text"]))),
    CONSTRAINT "finance_ledger_entries_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['gross_sale'::"text", 'discount'::"text", 'platform_fee'::"text", 'professional_payout'::"text", 'commerciale_commission'::"text", 'tax'::"text", 'adjustment'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."finance_payment_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "requested_provider" "text",
    "mode" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "coupon_code" character varying(50),
    "currency" character(3) DEFAULT 'EUR'::"bpchar" NOT NULL,
    "amount_gross_cents" integer NOT NULL,
    "amount_discount_cents" integer DEFAULT 0 NOT NULL,
    "amount_net_cents" integer NOT NULL,
    "status" "public"."finance_status" DEFAULT 'pending'::"public"."finance_status" NOT NULL,
    "checkout_session_ref" "text",
    "approval_url" "text",
    "fallback_provider" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confirmed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_payment_sessions_amount_discount_cents_check" CHECK (("amount_discount_cents" >= 0)),
    CONSTRAINT "finance_payment_sessions_amount_gross_cents_check" CHECK (("amount_gross_cents" >= 0)),
    CONSTRAINT "finance_payment_sessions_amount_net_cents_check" CHECK (("amount_net_cents" >= 0)),
    CONSTRAINT "finance_payment_sessions_currency_check" CHECK (("currency" = 'EUR'::"bpchar")),
    CONSTRAINT "finance_payment_sessions_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['premium'::"text", 'treatment'::"text"]))),
    CONSTRAINT "finance_payment_sessions_fallback_provider_check" CHECK (("fallback_provider" = ANY (ARRAY['stripe'::"text", 'klarna'::"text", 'paypal'::"text", 'cash'::"text"]))),
    CONSTRAINT "finance_payment_sessions_mode_check" CHECK (("mode" = ANY (ARRAY['immediate'::"text", 'installments'::"text"]))),
    CONSTRAINT "finance_payment_sessions_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'klarna'::"text", 'paypal'::"text", 'cash'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."finance_payout_batches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" NOT NULL,
    "currency" character(3) DEFAULT 'EUR'::"bpchar" NOT NULL,
    "total_amount_cents" integer DEFAULT 0 NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "executed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_payout_batches_currency_check" CHECK (("currency" = 'EUR'::"bpchar")),
    CONSTRAINT "finance_payout_batches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'executed'::"text", 'on_hold'::"text"]))),
    CONSTRAINT "finance_payout_batches_total_amount_cents_check" CHECK (("total_amount_cents" >= 0))
);


CREATE TABLE IF NOT EXISTS "public"."finance_payout_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "batch_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_ref" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "status" "text" NOT NULL,
    "hold_reason" "text",
    "due_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_payout_items_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "finance_payout_items_role_check" CHECK (("role" = ANY (ARRAY['medico'::"text", 'estetista'::"text", 'commerciale'::"text"]))),
    CONSTRAINT "finance_payout_items_source_type_check" CHECK (("source_type" = ANY (ARRAY['treatment'::"text", 'premium'::"text", 'commission'::"text", 'bonus_reimbursement'::"text"]))),
    CONSTRAINT "finance_payout_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'paid'::"text", 'on_hold'::"text", 'invoiced'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."finance_provider_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "provider" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text",
    "signature_valid" boolean DEFAULT false NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_provider_events_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'klarna'::"text", 'paypal'::"text", 'cash'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."finance_receipts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "receipt_number" "text" NOT NULL,
    "issue_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    "file_url" "text",
    "issuer_type" "text" NOT NULL,
    "issuer_user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_receipts_issuer_type_check" CHECK (("issuer_type" = ANY (ARRAY['bbw'::"text", 'professional'::"text"]))),
    CONSTRAINT "finance_receipts_status_check" CHECK (("status" = ANY (ARRAY['issued'::"text", 'sent'::"text", 'error'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."finance_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "transaction_ref" "text" NOT NULL,
    "status" "public"."finance_status" DEFAULT 'pending'::"public"."finance_status" NOT NULL,
    "amount_gross_cents" integer NOT NULL,
    "amount_discount_cents" integer DEFAULT 0 NOT NULL,
    "amount_net_cents" integer NOT NULL,
    "currency" character(3) DEFAULT 'EUR'::"bpchar" NOT NULL,
    "provider_payload" "jsonb",
    "captured_at" timestamp with time zone,
    "settled_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_transactions_amount_discount_cents_check" CHECK (("amount_discount_cents" >= 0)),
    CONSTRAINT "finance_transactions_amount_gross_cents_check" CHECK (("amount_gross_cents" >= 0)),
    CONSTRAINT "finance_transactions_amount_net_cents_check" CHECK (("amount_net_cents" >= 0)),
    CONSTRAINT "finance_transactions_currency_check" CHECK (("currency" = 'EUR'::"bpchar")),
    CONSTRAINT "finance_transactions_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'klarna'::"text", 'paypal'::"text", 'cash'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."forensic_anchor_batches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "merkle_root" "text" NOT NULL,
    "anchor_provider" "text" NOT NULL,
    "anchor_id" "text",
    "leaf_count" integer NOT NULL,
    "anchor_receipt" "jsonb"
);


CREATE TABLE IF NOT EXISTS "public"."forensic_audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_type" character varying(100) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" character varying(100) NOT NULL,
    "actor_id" "uuid",
    "actor_type" character varying(20) DEFAULT 'user'::character varying NOT NULL,
    "actor_ip" character varying(45),
    "actor_user_agent" "text",
    "changes" "jsonb",
    "previous_state" "jsonb",
    "new_state" "jsonb",
    "integrity_record_id" "uuid",
    "session_id" character varying(255),
    "request_id" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."forensic_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "previous_state" "jsonb",
    "new_state" "jsonb",
    "actor_id" "uuid",
    "actor_role" "text",
    "actor_name" "text",
    "ip_address" "text",
    "user_agent" "text",
    "risk_level" "text" DEFAULT 'low'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "forensic_audit_logs_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."forensic_chain_heads" (
    "chain_key" "text" NOT NULL,
    "head_event_id" "uuid",
    "head_hash" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."forensic_document_integrity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_type" "text" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "file_hash" "text" NOT NULL,
    "original_file_name" "text",
    "file_size" bigint,
    "mime_type" "text",
    "integrity_status" "text" DEFAULT 'pending'::"text",
    "integrity_checked_at" timestamp with time zone,
    "integrity_check_result" "jsonb",
    "uploaded_by" "uuid",
    "uploaded_ip" "text",
    "uploaded_user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deleted_reason" "text",
    CONSTRAINT "forensic_document_integrity_integrity_status_check" CHECK (("integrity_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'corrupted'::"text", 'tampered'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."forensic_event_anchors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "merkle_root" "text" NOT NULL,
    "merkle_leaf" "text" NOT NULL,
    "merkle_proof" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "leaf_index" integer NOT NULL,
    "leaf_count" integer NOT NULL,
    "anchor_provider" "text" NOT NULL,
    "anchor_id" "text"
);


CREATE TABLE IF NOT EXISTS "public"."forensic_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text" NOT NULL,
    "actor_company_id" "uuid",
    "action_type" "text" NOT NULL,
    "subject_type" "text" NOT NULL,
    "subject_id" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "payload_hash" "text" NOT NULL,
    "prev_hash" "text",
    "event_hash" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "device_fingerprint" "jsonb",
    "geolocation" "jsonb",
    "request_id" "text",
    "source" "text" DEFAULT 'api'::"text" NOT NULL,
    "integrity_version" integer DEFAULT 1 NOT NULL
);


CREATE OR REPLACE VIEW "public"."forensic_events_unanchored" WITH ("security_invoker"='true') AS
 SELECT "id",
    "event_hash",
    "created_at"
   FROM "public"."forensic_events" "e"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."forensic_event_anchors" "a"
          WHERE ("a"."event_id" = "e"."id"))));


CREATE TABLE IF NOT EXISTS "public"."forensic_integrity_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_type" character varying(100) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "entity_table" character varying(100) NOT NULL,
    "content_hash" character varying(64) NOT NULL,
    "previous_hash" character varying(64),
    "anchor_type" character varying(50) DEFAULT 'internal'::character varying NOT NULL,
    "anchor_tx_id" character varying(255),
    "anchor_proof" "text",
    "anchored_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "verification_status" character varying(20) DEFAULT 'pending'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."forensics_issue_resolutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "note" "text",
    "resolved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forensics_issue_resolutions_status_check" CHECK (("status" = ANY (ARRAY['resolved'::"text", 'archived'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."forum_categories" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE SEQUENCE IF NOT EXISTS "public"."forum_categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."forum_categories_id_seq" OWNED BY "public"."forum_categories"."id";


CREATE TABLE IF NOT EXISTS "public"."forum_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid",
    "post_id" "uuid",
    "flagged_by" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_flags_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "forum_flags_target_check" CHECK (((("thread_id" IS NOT NULL) AND ("post_id" IS NULL)) OR (("thread_id" IS NULL) AND ("post_id" IS NOT NULL))))
);


CREATE TABLE IF NOT EXISTS "public"."forum_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "is_flagged" boolean DEFAULT false NOT NULL,
    "parent_post_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_posts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'published'::"text", 'removed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."forum_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" integer NOT NULL,
    "user_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "reply_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_threads_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'published'::"text", 'removed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."gallery_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "treatment_id" "uuid",
    "treatment_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "before_image" "text" NOT NULL,
    "after_image" "text" NOT NULL,
    "before_date" "date" NOT NULL,
    "after_date" "date" NOT NULL,
    "is_public" boolean DEFAULT false,
    "client_consent" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "likes" integer DEFAULT 0,
    "views" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "gallery_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."gallery_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."insurance_daily_report_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "report_date" "date" NOT NULL,
    "customer_count" integer DEFAULT 0 NOT NULL,
    "payment_count" integer DEFAULT 0 NOT NULL,
    "total_insurance_amount_cents" integer DEFAULT 0 NOT NULL,
    "recipient_email" "text" NOT NULL,
    "status" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "insurance_daily_report_log_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'skipped_empty'::"text", 'failed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."insurance_manual_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "premium_payment_id" "uuid",
    "insurance_tier" "text" NOT NULL,
    "insurance_amount_cents" integer NOT NULL,
    "user_nome" "text" NOT NULL,
    "user_cognome" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "user_telefono" "text",
    "user_codice_fiscale" "text",
    "user_via" "text",
    "user_citta" "text",
    "user_provincia" "text",
    "user_cap" "text",
    "registered_at" timestamp with time zone,
    "registered_by_admin_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_data_nascita" "text",
    "finance_session_id" "uuid",
    CONSTRAINT "insurance_manual_registrations_insurance_tier_check" CHECK (("insurance_tier" = ANY (ARRAY['base'::"text", 'premium'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "commerciale_id" "uuid" NOT NULL,
    "type" "public"."invite_type" NOT NULL,
    "email" character varying(255),
    "nome" character varying(255),
    "cognome" character varying(255),
    "telefono" character varying(50),
    "accept_token" "uuid" DEFAULT "extensions"."uuid_generate_v4"(),
    "status" "public"."invite_status" DEFAULT 'pending'::"public"."invite_status" NOT NULL,
    "used_by" "uuid",
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "whatsapp_number" "text",
    "company_id" "uuid",
    "user_id" "uuid"
);


CREATE TABLE IF NOT EXISTS "public"."job_locks" (
    "lock_key" "text" NOT NULL,
    "locked_until" timestamp with time zone NOT NULL,
    "locked_by" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."job_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_key" "text" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "finished_at" timestamp with time zone,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    CONSTRAINT "job_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'skipped'::"text", 'error'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."kv_store_6af57f5a" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."legal_acceptances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "acceptance_type" "text" NOT NULL,
    "source" "text" DEFAULT 'registration'::"text" NOT NULL,
    "git_sha" "text" DEFAULT ''::"text" NOT NULL,
    "build_time" "text" DEFAULT ''::"text" NOT NULL,
    "document_ref" "text",
    "ip_address" "text",
    "user_agent" "text",
    "device_fingerprint" "jsonb",
    "geolocation" "jsonb",
    "request_id" "text"
);


CREATE TABLE IF NOT EXISTS "public"."legal_consent_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text" NOT NULL,
    "consent_template_id" "uuid",
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "verification_method" "text" NOT NULL,
    "verification_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."loyalty_credits_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "delta" numeric(10,2) NOT NULL,
    "credits_after" numeric(10,2) NOT NULL,
    "reason" "text" NOT NULL,
    "month_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."loyalty_program_terms_acceptances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "accepted_by" "uuid" NOT NULL,
    "terms_version" "text" DEFAULT '1.0'::"text" NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "text",
    CONSTRAINT "loyalty_program_terms_acceptances_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['company'::"text", 'user'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."loyalty_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "tier" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "stripe_subscription_id" "text",
    "monthly_euro" numeric(10,2) NOT NULL,
    "credit_type" "text" DEFAULT 'count'::"text" NOT NULL,
    "credits_per_month" numeric(10,2) NOT NULL,
    "rollover_enabled" boolean DEFAULT false NOT NULL,
    "credits_on_cancel" "text" DEFAULT 'expire_period_end'::"text" NOT NULL,
    "term_start" "date" NOT NULL,
    "term_end" "date",
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "billing_interval" "text" DEFAULT 'month'::"text" NOT NULL,
    "annual_euro" numeric(10,2),
    "subscription_price_cents" integer,
    "bbw_fee_cents" integer,
    "owner_share_cents" integer,
    CONSTRAINT "loyalty_subscriptions_annual_euro_check" CHECK ((("annual_euro" IS NULL) OR ("annual_euro" >= (0)::numeric))),
    CONSTRAINT "loyalty_subscriptions_bbw_fee_cents_check" CHECK ((("bbw_fee_cents" IS NULL) OR ("bbw_fee_cents" >= 0))),
    CONSTRAINT "loyalty_subscriptions_billing_interval_check" CHECK (("billing_interval" = ANY (ARRAY['month'::"text", 'year'::"text"]))),
    CONSTRAINT "loyalty_subscriptions_credit_type_check" CHECK (("credit_type" = ANY (ARRAY['count'::"text", 'euro'::"text"]))),
    CONSTRAINT "loyalty_subscriptions_credits_on_cancel_check" CHECK (("credits_on_cancel" = ANY (ARRAY['expire_immediate'::"text", 'expire_period_end'::"text"]))),
    CONSTRAINT "loyalty_subscriptions_credits_per_month_check" CHECK (("credits_per_month" >= (0)::numeric)),
    CONSTRAINT "loyalty_subscriptions_economic_split_consistent" CHECK (((("subscription_price_cents" IS NULL) AND ("bbw_fee_cents" IS NULL) AND ("owner_share_cents" IS NULL)) OR (("subscription_price_cents" IS NOT NULL) AND ("bbw_fee_cents" IS NOT NULL) AND ("owner_share_cents" IS NOT NULL) AND ("subscription_price_cents" = ("bbw_fee_cents" + "owner_share_cents"))))),
    CONSTRAINT "loyalty_subscriptions_monthly_euro_check" CHECK (("monthly_euro" >= (0)::numeric)),
    CONSTRAINT "loyalty_subscriptions_owner_share_cents_check" CHECK ((("owner_share_cents" IS NULL) OR ("owner_share_cents" >= 0))),
    CONSTRAINT "loyalty_subscriptions_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['company'::"text", 'user'::"text"]))),
    CONSTRAINT "loyalty_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "loyalty_subscriptions_subscription_price_cents_check" CHECK ((("subscription_price_cents" IS NULL) OR ("subscription_price_cents" >= 0))),
    CONSTRAINT "loyalty_subscriptions_tier_check" CHECK (("tier" = ANY (ARRAY['bronze_free'::"text", 'bronze'::"text", 'gold'::"text", 'platinum'::"text", 'diamond'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."message_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "read_by" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."message_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "last_message_id" "uuid",
    "archived_by" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "deleted_by" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."normalized_content_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source_name" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "title" "text" NOT NULL,
    "excerpt" "text",
    "language" "text" DEFAULT 'it'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "engagement_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."otps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reference" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "code" character varying(10) NOT NULL,
    "expires_at" bigint NOT NULL,
    "purpose" "public"."otp_purpose" NOT NULL,
    "user_id" "uuid",
    "user_type" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."patient_professional_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "status" "public"."binding_status" DEFAULT 'pending'::"public"."binding_status" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "clinic_access" boolean DEFAULT false NOT NULL,
    "request_date" timestamp with time zone DEFAULT "now"(),
    "response_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."payment_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "user_id" "uuid",
    "stripe_account_id" "text",
    "stripe_onboarding_done" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paypal_merchant_id" "text",
    "paypal_onboarding_done" boolean DEFAULT false NOT NULL,
    "paypal_payments_receivable" boolean DEFAULT false NOT NULL,
    "paypal_primary_email_confirmed" boolean DEFAULT false NOT NULL,
    "paypal_tracking_id" "text",
    "paypal_status_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "paypal_connected_at" timestamp with time zone,
    "paypal_disconnected_at" timestamp with time zone,
    CONSTRAINT "payment_accounts_exactly_one_owner" CHECK (((("company_id" IS NOT NULL) AND ("user_id" IS NULL)) OR (("company_id" IS NULL) AND ("user_id" IS NOT NULL))))
);


CREATE TABLE IF NOT EXISTS "public"."platform_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "message" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "details_text" "text" GENERATED ALWAYS AS (("details")::"text") STORED
);


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "text" DEFAULT 'singleton'::"text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "llm_validated" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


CREATE TABLE IF NOT EXISTS "public"."platform_treatments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "duration" "text" NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "price" numeric,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "allowed_roles" "text"[] DEFAULT ARRAY['medico'::"text", 'estetista'::"text"] NOT NULL,
    "description_male" "text",
    "description_female" "text",
    "image_male_path" "text",
    "image_female_path" "text",
    "automatic_consents_active" boolean DEFAULT true NOT NULL,
    "insurance_included" boolean DEFAULT false NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."points_ledger" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "delta" integer NOT NULL,
    "reason" "text" NOT NULL,
    "ref_type" "text",
    "ref_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid"
);


CREATE TABLE IF NOT EXISTS "public"."points_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "delta" integer NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."premium_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_invoice_id" "text" NOT NULL,
    "amount_gross_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'eur'::"text" NOT NULL,
    "paid_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_charge_id" "text",
    "stripe_transfer_id" "text",
    "stripe_price_id" "text",
    "payment_plan" "text",
    "insurance_amount_cents" integer,
    "platform_amount_cents" integer,
    CONSTRAINT "premium_payments_payment_plan_check" CHECK (("payment_plan" = ANY (ARRAY['monthly'::"text", 'annual'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."premium_renewal_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reminder_days" integer DEFAULT 40 NOT NULL,
    "term_end" timestamp with time zone NOT NULL,
    "recipient_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "email_message_id" "text",
    "sent_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "premium_renewal_reminders_reminder_days_check" CHECK (("reminder_days" = 40)),
    CONSTRAINT "premium_renewal_reminders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."premium_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "term_start" timestamp with time zone,
    "term_end" timestamp with time zone,
    "paid_months_in_term" integer DEFAULT 0 NOT NULL,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "premium_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'cancelled'::"text", 'cancelled_early'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."professional_catalog_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "platform_treatment_id" "uuid",
    "custom_service_id" "uuid",
    "custom_price" numeric(10,2),
    "points_override" integer,
    "duration_override" integer,
    "consent_template_id" "uuid",
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "disclaimer_accepted" boolean DEFAULT false NOT NULL,
    "disclaimer_accepted_at" timestamp with time zone,
    "disclaimer_accepted_by" "uuid",
    "category" "text" DEFAULT 'estetica_avanzata'::"text" NOT NULL,
    CONSTRAINT "professional_catalog_items_source_consistency" CHECK (((("source_type" = 'platform'::"text") AND ("platform_treatment_id" IS NOT NULL) AND ("custom_service_id" IS NULL)) OR (("source_type" = 'custom'::"text") AND ("custom_service_id" IS NOT NULL) AND ("platform_treatment_id" IS NULL)))),
    CONSTRAINT "professional_catalog_items_source_ref_chk" CHECK (((("source_type" = 'platform'::"text") AND ("platform_treatment_id" IS NOT NULL) AND ("custom_service_id" IS NULL)) OR (("source_type" = 'custom'::"text") AND ("custom_service_id" IS NOT NULL) AND ("platform_treatment_id" IS NULL)))),
    CONSTRAINT "professional_catalog_items_source_type_check" CHECK (("source_type" = ANY (ARRAY['platform'::"text", 'custom'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."professional_contract_renewal_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'medico'::"text" NOT NULL,
    "reminder_days" integer DEFAULT 40 NOT NULL,
    "signed_at" timestamp with time zone NOT NULL,
    "renewal_at" timestamp with time zone NOT NULL,
    "recipient_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "email_message_id" "text",
    "sent_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "professional_contract_renewal_reminders_reminder_days_check" CHECK (("reminder_days" = 40)),
    CONSTRAINT "professional_contract_renewal_reminders_role_check" CHECK (("role" = 'medico'::"text")),
    CONSTRAINT "professional_contract_renewal_reminders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."professional_disclaimer_acceptances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid",
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "inet",
    "user_agent" "text"
);


CREATE TABLE IF NOT EXISTS "public"."professional_offered_treatments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "platform_treatment_id" "uuid" NOT NULL,
    "custom_price" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."professional_verifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "professional_type" "public"."professional_type" NOT NULL,
    "status" "public"."verification_status" DEFAULT 'pending'::"public"."verification_status" NOT NULL,
    "last_update" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "asl_due_at" timestamp with time zone,
    "operational_blocked" boolean DEFAULT false,
    "operational_block_reason" "text",
    "notes" "text",
    "checklist" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "identity_due_at" timestamp with time zone,
    "insurance_due_at" timestamp with time zone
);


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."referral_codes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "usage_count" integer DEFAULT 0 NOT NULL,
    "max_usage" integer
);


CREATE TABLE IF NOT EXISTS "public"."referral_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referral_id" "uuid" NOT NULL,
    "referrer_user_id" "uuid" NOT NULL,
    "referred_user_id" "uuid" NOT NULL,
    "stripe_invoice_id" "text" NOT NULL,
    "amount_gross_cents" integer NOT NULL,
    "percent_snapshot" numeric(6,3) NOT NULL,
    "amount_commission_cents" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "referrer_id" "uuid" NOT NULL,
    "referred_id" "uuid" NOT NULL,
    "code_used" character varying(50) NOT NULL,
    "points_awarded" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "percent_snapshot" numeric(6,3),
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "premium_reward_points" integer DEFAULT 0 NOT NULL,
    "premium_rewarded_at" timestamp with time zone,
    "company_id" "uuid",
    "professional_id" "uuid",
    "first_purchase_reward_points" integer DEFAULT 0 NOT NULL,
    "first_purchase_rewarded_at" timestamp with time zone
);


CREATE TABLE IF NOT EXISTS "public"."sensitive_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "purpose" "text" NOT NULL,
    "method" "text" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "ip_address" "text",
    "user_agent" "text",
    "request_id" "text"
);


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "numero_abbonamento" character varying(100) NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'PENDING'::"public"."subscription_status" NOT NULL,
    "data_inizio" "date" NOT NULL,
    "data_scadenza" "date" NOT NULL,
    "importo_lordo" numeric(10,2) NOT NULL,
    "importo_netto" numeric(10,2) NOT NULL,
    "iva" numeric(10,2) NOT NULL,
    "metodo_pagamento" character varying(50) NOT NULL,
    "transaction_id" character varying(255),
    "data_pagamento" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."treatments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "treatment_name" character varying(255) NOT NULL,
    "description" "text",
    "date" "date" NOT NULL,
    "duration" integer,
    "price" numeric(10,2) NOT NULL,
    "points" integer DEFAULT 0,
    "type" character varying(100),
    "category" character varying(100),
    "location" character varying(255),
    "notes" "text",
    "status" "public"."treatment_status" DEFAULT 'scheduled'::"public"."treatment_status" NOT NULL,
    "consenso_informato_url" "text",
    "etichetta_farmaco_url" "text",
    "farmaco_lotto" character varying(100),
    "farmaco_scadenza" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "booking_id" "uuid",
    "rating" integer,
    "review_text" "text",
    "review_submitted_at" timestamp with time zone,
    "company_id" "uuid",
    "room_id" "uuid",
    CONSTRAINT "treatments_rating_range_chk" CHECK ((("rating" IS NULL) OR (("rating" >= 1) AND ("rating" <= 5))))
);


CREATE TABLE IF NOT EXISTS "public"."trend_cluster_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trend_cluster_id" "uuid" NOT NULL,
    "normalized_content_item_id" "uuid" NOT NULL,
    "relevance_score" numeric(5,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."trend_clusters" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "topic" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "lifecycle_stage" "text" DEFAULT 'emerging'::"text" NOT NULL,
    "confidence_score" numeric(5,2) DEFAULT 0 NOT NULL,
    "geography" "text" DEFAULT 'global'::"text" NOT NULL,
    "source_window_start" timestamp with time zone DEFAULT ("now"() - '24:00:00'::interval) NOT NULL,
    "source_window_end" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trend_clusters_lifecycle_stage_check" CHECK (("lifecycle_stage" = ANY (ARRAY['emerging'::"text", 'rising'::"text", 'peak'::"text", 'cooling'::"text"]))),
    CONSTRAINT "trend_clusters_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suppressed'::"text", 'archived'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."trend_scores" (
    "trend_cluster_id" "uuid" NOT NULL,
    "velocity_score" numeric(6,2) DEFAULT 0 NOT NULL,
    "cross_source_score" numeric(6,2) DEFAULT 0 NOT NULL,
    "novelty_score" numeric(6,2) DEFAULT 0 NOT NULL,
    "engagement_score" numeric(6,2) DEFAULT 0 NOT NULL,
    "total_score" numeric(6,2) DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."user_auth_links" (
    "auth_user_id" "uuid" NOT NULL,
    "app_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."user_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "requested_by" "uuid",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scheduled_purge_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending_email_confirm'::"text" NOT NULL,
    "confirmation_token_hash" "text",
    "confirmation_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_reason" "text",
    "purged_at" timestamp with time zone,
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pec_confirmation_at" timestamp with time zone,
    "pec_confirmation_source" "text",
    "pec_confirmation_by" "uuid",
    CONSTRAINT "user_deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['pending_email_confirm'::"text", 'confirmed'::"text", 'cancelled'::"text", 'purged'::"text", 'failed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."user_loyalty_program_configs" (
    "user_id" "uuid" NOT NULL,
    "feature_enabled" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_availability" "jsonb",
    "loyalty_activation_expires_at" timestamp with time zone
);


CREATE TABLE IF NOT EXISTS "public"."verification_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "verification_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "type" "public"."document_type" NOT NULL,
    "url" "text",
    "status" "public"."verification_status" DEFAULT 'pending'::"public"."verification_status" NOT NULL,
    "uploaded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "file_hash" "text",
    "file_size" bigint,
    "mime_type" "text",
    "uploaded_by" "uuid",
    "uploaded_ip" "text",
    "uploaded_user_agent" "text",
    "integrity_status" "text",
    "integrity_checked_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deleted_reason" "text",
    "rejection_reason" "text"
);


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "description" "text" NOT NULL,
    "reference_id" "text",
    "reference_type" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "balance_after" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "completed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    CONSTRAINT "wallet_transactions_reference_type_check" CHECK (("reference_type" = ANY (ARRAY['booking'::"text", 'treatment'::"text", 'referral'::"text", 'promotion'::"text", 'manual'::"text"]))),
    CONSTRAINT "wallet_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "wallet_transactions_type_check" CHECK (("type" = ANY (ARRAY['credit'::"text", 'debit'::"text", 'refund'::"text", 'bonus'::"text", 'points_conversion'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "pending_balance" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "total_earned" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "total_spent" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


CREATE TABLE IF NOT EXISTS "trash"."coupons" (
    "id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "type" "public"."coupon_type" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "description" "text",
    "min_purchase" numeric(10,2),
    "max_uses" integer,
    "used_count" integer,
    "valid_from" timestamp with time zone,
    "valid_until" timestamp with time zone,
    "status" "public"."coupon_status",
    "created_at" timestamp with time zone,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by" "uuid",
    "media_url" "text",
    "company_id" "uuid"
);


CREATE TABLE IF NOT EXISTS "trash"."custom_services" (
    "id" "uuid" NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "category" "public"."service_category" DEFAULT 'altro'::"public"."service_category" NOT NULL,
    "duration" integer,
    "price" numeric(10,2) NOT NULL,
    "points" integer DEFAULT 0,
    "location" character varying(255),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by" "uuid"
);


CREATE TABLE IF NOT EXISTS "trash"."invites" (
    "id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "commerciale_id" "uuid",
    "type" "public"."invite_type" NOT NULL,
    "email" character varying(255),
    "nome" character varying(255),
    "cognome" character varying(255),
    "telefono" character varying(50),
    "accept_token" "uuid",
    "status" "public"."invite_status" NOT NULL,
    "used_by" "uuid",
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by" "uuid"
);


CREATE TABLE IF NOT EXISTS "trash"."treatments" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "treatment_name" character varying(255) NOT NULL,
    "description" "text",
    "date" "date" NOT NULL,
    "duration" integer,
    "price" numeric(10,2) NOT NULL,
    "points" integer,
    "type" character varying(100),
    "category" character varying(100),
    "location" character varying(255),
    "notes" "text",
    "status" "public"."treatment_status" NOT NULL,
    "consenso_informato_url" "text",
    "etichetta_farmaco_url" "text",
    "farmaco_lotto" character varying(100),
    "farmaco_scadenza" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by" "uuid",
    "booking_id" "uuid",
    "company_id" "uuid"
);


CREATE TABLE IF NOT EXISTS "trash"."users" (
    "user_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by" "uuid"
);


ALTER TABLE ONLY "public"."forum_categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."forum_categories_id_seq"'::"regclass");


ALTER TABLE ONLY "public"."backfill_review"
    ADD CONSTRAINT "backfill_review_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."binding_requests"
    ADD CONSTRAINT "binding_requests_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."board_listing_quotas"
    ADD CONSTRAINT "board_listing_quotas_pkey" PRIMARY KEY ("user_id");


ALTER TABLE ONLY "public"."board_listing_reports"
    ADD CONSTRAINT "board_listing_reports_listing_id_reporter_user_id_key" UNIQUE ("listing_id", "reporter_user_id");


ALTER TABLE ONLY "public"."board_listing_reports"
    ADD CONSTRAINT "board_listing_reports_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."board_listings"
    ADD CONSTRAINT "board_listings_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."booking_availability"
    ADD CONSTRAINT "booking_availability_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."booking_blocked_slots"
    ADD CONSTRAINT "booking_blocked_slots_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."booking_notification_deliveries"
    ADD CONSTRAINT "booking_notification_deliveri_booking_id_notification_type__key" UNIQUE ("booking_id", "notification_type", "recipient_user_id");


ALTER TABLE ONLY "public"."booking_notification_deliveries"
    ADD CONSTRAINT "booking_notification_deliveries_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."booking_settings"
    ADD CONSTRAINT "booking_settings_medico_id_key" UNIQUE ("medico_id");


ALTER TABLE ONLY "public"."booking_settings"
    ADD CONSTRAINT "booking_settings_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."commerciale_rewards"
    ADD CONSTRAINT "commerciale_rewards_commerciale_id_cliente_id_key" UNIQUE ("commerciale_id", "cliente_id");


ALTER TABLE ONLY "public"."commerciale_rewards"
    ADD CONSTRAINT "commerciale_rewards_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."commerciale_settings"
    ADD CONSTRAINT "commerciale_settings_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."commerciale_settings"
    ADD CONSTRAINT "commerciale_settings_user_id_key" UNIQUE ("user_id");


ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_codice_clinica_key" UNIQUE ("codice_clinica");


ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_paypal_email_unique" UNIQUE ("paypal_email");


ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_stripe_email_unique" UNIQUE ("stripe_email");


ALTER TABLE ONLY "public"."company_clients"
    ADD CONSTRAINT "company_clients_company_id_client_user_id_key" UNIQUE ("company_id", "client_user_id");


ALTER TABLE ONLY "public"."company_clients"
    ADD CONSTRAINT "company_clients_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."company_commerciale_links"
    ADD CONSTRAINT "company_commerciale_links_company_id_commerciale_id_key" UNIQUE ("company_id", "commerciale_id");


ALTER TABLE ONLY "public"."company_commerciale_links"
    ADD CONSTRAINT "company_commerciale_links_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."company_contacts"
    ADD CONSTRAINT "company_contacts_company_id_contact_id_key" UNIQUE ("company_id", "contact_id");


ALTER TABLE ONLY "public"."company_contacts"
    ADD CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."company_member_invites"
    ADD CONSTRAINT "company_member_invites_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."company_member_invites"
    ADD CONSTRAINT "company_member_invites_token_key" UNIQUE ("token");


ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."company_rooms"
    ADD CONSTRAINT "company_rooms_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."company_service_catalog"
    ADD CONSTRAINT "company_service_catalog_company_id_service_id_professional__key" UNIQUE ("company_id", "service_id", "professional_id");


ALTER TABLE ONLY "public"."company_service_catalog"
    ADD CONSTRAINT "company_service_catalog_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."company_service_requests"
    ADD CONSTRAINT "company_service_requests_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."company_service_requests"
    ADD CONSTRAINT "company_service_requests_token_key" UNIQUE ("token");


ALTER TABLE ONLY "public"."consent_audit_logs"
    ADD CONSTRAINT "consent_audit_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."consent_document_versions"
    ADD CONSTRAINT "consent_document_versions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."consent_documents"
    ADD CONSTRAINT "consent_documents_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."consent_share_tokens"
    ADD CONSTRAINT "consent_share_tokens_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."consent_share_tokens"
    ADD CONSTRAINT "consent_share_tokens_token_key" UNIQUE ("token");


ALTER TABLE ONLY "public"."consent_signatures"
    ADD CONSTRAINT "consent_signatures_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."consent_templates"
    ADD CONSTRAINT "consent_templates_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."contacts_trash"
    ADD CONSTRAINT "contacts_trash_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");


ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."credibility_audit_events"
    ADD CONSTRAINT "credibility_audit_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."credibility_checks"
    ADD CONSTRAINT "credibility_checks_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."credibility_documents"
    ADD CONSTRAINT "credibility_documents_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."credibility_issues"
    ADD CONSTRAINT "credibility_issues_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."credibility_mentions"
    ADD CONSTRAINT "credibility_mentions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."credibility_reviews"
    ADD CONSTRAINT "credibility_reviews_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."credibility_scores"
    ADD CONSTRAINT "credibility_scores_check_id_key" UNIQUE ("check_id");


ALTER TABLE ONLY "public"."credibility_scores"
    ADD CONSTRAINT "credibility_scores_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."custom_services"
    ADD CONSTRAINT "custom_services_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."editorial_articles"
    ADD CONSTRAINT "editorial_articles_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."editorial_audit_events"
    ADD CONSTRAINT "editorial_audit_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."editorial_homepage_slots"
    ADD CONSTRAINT "editorial_homepage_slots_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."editorial_job_heartbeats"
    ADD CONSTRAINT "editorial_job_heartbeats_pkey" PRIMARY KEY ("job_key");


ALTER TABLE ONLY "public"."editorial_publications"
    ADD CONSTRAINT "editorial_publications_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."editorial_user_events"
    ADD CONSTRAINT "editorial_user_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."editorial_user_preferences"
    ADD CONSTRAINT "editorial_user_preferences_pkey" PRIMARY KEY ("user_id");


ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."email_domain_blacklist"
    ADD CONSTRAINT "email_domain_blacklist_pkey" PRIMARY KEY ("domain");


ALTER TABLE ONLY "public"."email_events"
    ADD CONSTRAINT "email_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."email_forwards"
    ADD CONSTRAINT "email_forwards_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."email_suppressions"
    ADD CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."event_logs"
    ADD CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_bonus_reimbursement_batches"
    ADD CONSTRAINT "finance_bonus_reimbursement_batches_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_bonus_reimbursement_batches"
    ADD CONSTRAINT "finance_bonus_reimbursement_batches_professional_id_month_key" UNIQUE ("professional_id", "month");


ALTER TABLE ONLY "public"."finance_installment_plans"
    ADD CONSTRAINT "finance_installment_plans_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_invoice_jobs"
    ADD CONSTRAINT "finance_invoice_jobs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_ledger_entries"
    ADD CONSTRAINT "finance_ledger_entries_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_payment_sessions"
    ADD CONSTRAINT "finance_payment_sessions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_payout_batches"
    ADD CONSTRAINT "finance_payout_batches_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_payout_items"
    ADD CONSTRAINT "finance_payout_items_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_provider_events"
    ADD CONSTRAINT "finance_provider_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_provider_events"
    ADD CONSTRAINT "finance_provider_events_provider_event_id_key" UNIQUE ("provider", "event_id");


ALTER TABLE ONLY "public"."finance_receipts"
    ADD CONSTRAINT "finance_receipts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_receipts"
    ADD CONSTRAINT "finance_receipts_receipt_number_key" UNIQUE ("receipt_number");


ALTER TABLE ONLY "public"."finance_receipts"
    ADD CONSTRAINT "finance_receipts_transaction_id_key" UNIQUE ("transaction_id");


ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_payment_session_id_key" UNIQUE ("payment_session_id");


ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_provider_transaction_ref_key" UNIQUE ("provider", "transaction_ref");


ALTER TABLE ONLY "public"."forensic_anchor_batches"
    ADD CONSTRAINT "forensic_anchor_batches_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forensic_audit_log"
    ADD CONSTRAINT "forensic_audit_log_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forensic_audit_logs"
    ADD CONSTRAINT "forensic_audit_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forensic_chain_heads"
    ADD CONSTRAINT "forensic_chain_heads_pkey" PRIMARY KEY ("chain_key");


ALTER TABLE ONLY "public"."forensic_document_integrity"
    ADD CONSTRAINT "forensic_document_integrity_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forensic_event_anchors"
    ADD CONSTRAINT "forensic_event_anchors_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forensic_events"
    ADD CONSTRAINT "forensic_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forensic_integrity_records"
    ADD CONSTRAINT "forensic_integrity_records_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forensics_issue_resolutions"
    ADD CONSTRAINT "forensics_issue_resolutions_entity_type_entity_id_key" UNIQUE ("entity_type", "entity_id");


ALTER TABLE ONLY "public"."forensics_issue_resolutions"
    ADD CONSTRAINT "forensics_issue_resolutions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forum_categories"
    ADD CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forum_categories"
    ADD CONSTRAINT "forum_categories_slug_key" UNIQUE ("slug");


ALTER TABLE ONLY "public"."forum_flags"
    ADD CONSTRAINT "forum_flags_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."forum_threads"
    ADD CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."gallery_items"
    ADD CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."gallery_likes"
    ADD CONSTRAINT "gallery_likes_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."gallery_likes"
    ADD CONSTRAINT "gallery_likes_user_id_item_id_key" UNIQUE ("user_id", "item_id");


ALTER TABLE ONLY "public"."insurance_daily_report_log"
    ADD CONSTRAINT "insurance_daily_report_log_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."insurance_manual_registrations"
    ADD CONSTRAINT "insurance_manual_registrations_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_code_key" UNIQUE ("code");


ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."job_locks"
    ADD CONSTRAINT "job_locks_pkey" PRIMARY KEY ("lock_key");


ALTER TABLE ONLY "public"."job_runs"
    ADD CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."kv_store_6af57f5a"
    ADD CONSTRAINT "kv_store_6af57f5a_pkey" PRIMARY KEY ("key");


ALTER TABLE ONLY "public"."legal_acceptances"
    ADD CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."legal_consent_audit_logs"
    ADD CONSTRAINT "legal_consent_audit_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."loyalty_credits_ledger"
    ADD CONSTRAINT "loyalty_credits_ledger_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."loyalty_program_terms_acceptances"
    ADD CONSTRAINT "loyalty_program_terms_accepta_owner_type_owner_id_terms_ver_key" UNIQUE ("owner_type", "owner_id", "terms_version");


ALTER TABLE ONLY "public"."loyalty_program_terms_acceptances"
    ADD CONSTRAINT "loyalty_program_terms_acceptances_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."loyalty_subscriptions"
    ADD CONSTRAINT "loyalty_subscriptions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."loyalty_subscriptions"
    ADD CONSTRAINT "loyalty_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");


ALTER TABLE ONLY "public"."message_messages"
    ADD CONSTRAINT "message_messages_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."normalized_content_items"
    ADD CONSTRAINT "normalized_content_items_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."otps"
    ADD CONSTRAINT "otps_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."otps"
    ADD CONSTRAINT "otps_reference_key" UNIQUE ("reference");


ALTER TABLE ONLY "public"."patient_professional_links"
    ADD CONSTRAINT "patient_professional_links_patient_id_professional_id_key" UNIQUE ("patient_id", "professional_id");


ALTER TABLE ONLY "public"."patient_professional_links"
    ADD CONSTRAINT "patient_professional_links_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_paypal_merchant_id_key" UNIQUE ("paypal_merchant_id");


ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_paypal_tracking_id_key" UNIQUE ("paypal_tracking_id");


ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_stripe_account_id_key" UNIQUE ("stripe_account_id");


ALTER TABLE ONLY "public"."platform_logs"
    ADD CONSTRAINT "platform_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."platform_treatments"
    ADD CONSTRAINT "platform_treatments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."platform_treatments"
    ADD CONSTRAINT "platform_treatments_slug_key" UNIQUE ("slug");


ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."premium_payments"
    ADD CONSTRAINT "premium_payments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."premium_payments"
    ADD CONSTRAINT "premium_payments_stripe_invoice_id_key" UNIQUE ("stripe_invoice_id");


ALTER TABLE ONLY "public"."premium_renewal_reminders"
    ADD CONSTRAINT "premium_renewal_reminders_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."premium_renewal_reminders"
    ADD CONSTRAINT "premium_renewal_reminders_subscription_id_reminder_days_ter_key" UNIQUE ("subscription_id", "reminder_days", "term_end");


ALTER TABLE ONLY "public"."premium_subscriptions"
    ADD CONSTRAINT "premium_subscriptions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."premium_subscriptions"
    ADD CONSTRAINT "premium_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");


ALTER TABLE ONLY "public"."professional_catalog_items"
    ADD CONSTRAINT "professional_catalog_items_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."professional_catalog_items"
    ADD CONSTRAINT "professional_catalog_items_unique_custom" UNIQUE ("professional_id", "custom_service_id");


ALTER TABLE ONLY "public"."professional_catalog_items"
    ADD CONSTRAINT "professional_catalog_items_unique_platform" UNIQUE ("professional_id", "platform_treatment_id");


ALTER TABLE ONLY "public"."professional_contract_renewal_reminders"
    ADD CONSTRAINT "professional_contract_renewal_reminders_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."professional_contract_renewal_reminders"
    ADD CONSTRAINT "professional_contract_renewal_user_id_role_reminder_days_re_key" UNIQUE ("user_id", "role", "reminder_days", "renewal_at");


ALTER TABLE ONLY "public"."professional_disclaimer_acceptances"
    ADD CONSTRAINT "professional_disclaimer_acceptances_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."professional_disclaimer_acceptances"
    ADD CONSTRAINT "professional_disclaimer_acceptances_professional_id_key" UNIQUE ("professional_id");


ALTER TABLE ONLY "public"."professional_offered_treatments"
    ADD CONSTRAINT "professional_offered_treatmen_professional_id_platform_trea_key" UNIQUE ("professional_id", "platform_treatment_id");


ALTER TABLE ONLY "public"."professional_offered_treatments"
    ADD CONSTRAINT "professional_offered_treatments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."professional_verifications"
    ADD CONSTRAINT "professional_verifications_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."professional_verifications"
    ADD CONSTRAINT "professional_verifications_user_id_key" UNIQUE ("user_id");


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_code_key" UNIQUE ("code");


ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."referral_commissions"
    ADD CONSTRAINT "referral_commissions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."referral_commissions"
    ADD CONSTRAINT "referral_commissions_stripe_invoice_id_key" UNIQUE ("stripe_invoice_id");


ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."sensitive_verifications"
    ADD CONSTRAINT "sensitive_verifications_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_numero_abbonamento_key" UNIQUE ("numero_abbonamento");


ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."trend_cluster_items"
    ADD CONSTRAINT "trend_cluster_items_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."trend_cluster_items"
    ADD CONSTRAINT "trend_cluster_items_trend_cluster_id_normalized_content_ite_key" UNIQUE ("trend_cluster_id", "normalized_content_item_id");


ALTER TABLE ONLY "public"."trend_clusters"
    ADD CONSTRAINT "trend_clusters_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."trend_scores"
    ADD CONSTRAINT "trend_scores_pkey" PRIMARY KEY ("trend_cluster_id");


ALTER TABLE ONLY "public"."user_auth_links"
    ADD CONSTRAINT "user_auth_links_app_user_id_key" UNIQUE ("app_user_id");


ALTER TABLE ONLY "public"."user_auth_links"
    ADD CONSTRAINT "user_auth_links_pkey" PRIMARY KEY ("auth_user_id");


ALTER TABLE ONLY "public"."user_deletion_requests"
    ADD CONSTRAINT "user_deletion_requests_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."user_loyalty_program_configs"
    ADD CONSTRAINT "user_loyalty_program_configs_pkey" PRIMARY KEY ("user_id");


ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_codice_fiscale_key" UNIQUE ("codice_fiscale");


ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");


ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."verification_documents"
    ADD CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_key" UNIQUE ("user_id");


ALTER TABLE ONLY "trash"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "trash"."custom_services"
    ADD CONSTRAINT "custom_services_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "trash"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "trash"."treatments"
    ADD CONSTRAINT "treatments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "trash"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");


CREATE INDEX "companies_created_by_idx" ON "public"."companies" USING "btree" ("created_by");


CREATE INDEX "company_clients_active_idx" ON "public"."company_clients" USING "btree" ("company_id", "is_active");


CREATE INDEX "company_clients_client_user_id_idx" ON "public"."company_clients" USING "btree" ("client_user_id");


CREATE INDEX "company_contacts_active_idx" ON "public"."company_contacts" USING "btree" ("company_id", "is_active");


CREATE INDEX "company_contacts_contact_id_idx" ON "public"."company_contacts" USING "btree" ("contact_id");


CREATE INDEX "company_member_invites_company_id_idx" ON "public"."company_member_invites" USING "btree" ("company_id");


CREATE UNIQUE INDEX "company_member_invites_company_user_pending_uq" ON "public"."company_member_invites" USING "btree" ("company_id", "user_id") WHERE (("user_id" IS NOT NULL) AND ("status" = 'pending'::"text"));


CREATE INDEX "company_member_invites_email_idx" ON "public"."company_member_invites" USING "btree" ("lower"("email"));


CREATE INDEX "company_member_invites_status_idx" ON "public"."company_member_invites" USING "btree" ("status");


CREATE INDEX "company_members_company_id_idx" ON "public"."company_members" USING "btree" ("company_id");


CREATE UNIQUE INDEX "company_members_company_user_uq" ON "public"."company_members" USING "btree" ("company_id", "user_id");


CREATE INDEX "company_members_role_idx" ON "public"."company_members" USING "btree" ("role");


CREATE INDEX "company_members_user_id_idx" ON "public"."company_members" USING "btree" ("user_id");


CREATE UNIQUE INDEX "company_rooms_active_name_unique" ON "public"."company_rooms" USING "btree" ("company_id", "lower"(TRIM(BOTH FROM "name"))) WHERE ("is_active" = true);


CREATE INDEX "email_suppressions_created_at_idx" ON "public"."email_suppressions" USING "btree" ("created_at" DESC);


CREATE UNIQUE INDEX "email_suppressions_email_active_uq" ON "public"."email_suppressions" USING "btree" ("lower"("email")) WHERE ("unsuppressed_at" IS NULL);


CREATE INDEX "email_suppressions_reason_idx" ON "public"."email_suppressions" USING "btree" ("reason");


CREATE INDEX "forensic_anchor_batches_created_at_idx" ON "public"."forensic_anchor_batches" USING "btree" ("created_at" DESC);


CREATE INDEX "forensic_chain_heads_updated_at_idx" ON "public"."forensic_chain_heads" USING "btree" ("updated_at" DESC);


CREATE INDEX "forensic_event_anchors_batch_id_idx" ON "public"."forensic_event_anchors" USING "btree" ("batch_id");


CREATE INDEX "forensic_event_anchors_created_at_idx" ON "public"."forensic_event_anchors" USING "btree" ("created_at" DESC);


CREATE UNIQUE INDEX "forensic_event_anchors_event_id_uidx" ON "public"."forensic_event_anchors" USING "btree" ("event_id");


CREATE INDEX "forensic_events_action_type_idx" ON "public"."forensic_events" USING "btree" ("action_type");


CREATE INDEX "forensic_events_actor_company_id_idx" ON "public"."forensic_events" USING "btree" ("actor_company_id");


CREATE INDEX "forensic_events_actor_id_idx" ON "public"."forensic_events" USING "btree" ("actor_id");


CREATE INDEX "forensic_events_created_at_idx" ON "public"."forensic_events" USING "btree" ("created_at" DESC);


CREATE UNIQUE INDEX "forensic_events_event_hash_uidx" ON "public"."forensic_events" USING "btree" ("event_hash");


CREATE INDEX "forensic_events_subject_idx" ON "public"."forensic_events" USING "btree" ("subject_type", "subject_id");


CREATE INDEX "idx_binding_requests_commerciale_id" ON "public"."binding_requests" USING "btree" ("commerciale_id");


CREATE INDEX "idx_binding_requests_medico_id" ON "public"."binding_requests" USING "btree" ("medico_id");


CREATE INDEX "idx_binding_requests_status" ON "public"."binding_requests" USING "btree" ("status");


CREATE INDEX "idx_binding_requests_user_id" ON "public"."binding_requests" USING "btree" ("user_id");


CREATE INDEX "idx_board_listing_reports_listing" ON "public"."board_listing_reports" USING "btree" ("listing_id", "status");


CREATE INDEX "idx_board_listing_reports_reporter_user_id_fk" ON "public"."board_listing_reports" USING "btree" ("reporter_user_id");


CREATE INDEX "idx_board_listing_reports_reviewed_by_fk" ON "public"."board_listing_reports" USING "btree" ("reviewed_by");


CREATE INDEX "idx_board_listings_approved_by_fk" ON "public"."board_listings" USING "btree" ("approved_by");


CREATE INDEX "idx_board_listings_status_published" ON "public"."board_listings" USING "btree" ("status", "published_at" DESC);


CREATE INDEX "idx_board_listings_type" ON "public"."board_listings" USING "btree" ("type");


CREATE INDEX "idx_board_listings_user_id" ON "public"."board_listings" USING "btree" ("user_id");


CREATE INDEX "idx_bonus_reimb_batches_professional" ON "public"."finance_bonus_reimbursement_batches" USING "btree" ("professional_id");


CREATE INDEX "idx_bonus_reimb_batches_status" ON "public"."finance_bonus_reimbursement_batches" USING "btree" ("status");


CREATE INDEX "idx_booking_availability_company_id" ON "public"."booking_availability" USING "btree" ("company_id") WHERE ("company_id" IS NOT NULL);


CREATE INDEX "idx_booking_availability_company_id_fk" ON "public"."booking_availability" USING "btree" ("company_id");


CREATE INDEX "idx_booking_availability_medico_id" ON "public"."booking_availability" USING "btree" ("medico_id");


CREATE INDEX "idx_booking_blocked_slots_company_id" ON "public"."booking_blocked_slots" USING "btree" ("company_id") WHERE ("company_id" IS NOT NULL);


CREATE INDEX "idx_booking_blocked_slots_company_id_fk" ON "public"."booking_blocked_slots" USING "btree" ("company_id");


CREATE INDEX "idx_booking_blocked_slots_date" ON "public"."booking_blocked_slots" USING "btree" ("date");


CREATE INDEX "idx_booking_blocked_slots_medico_id" ON "public"."booking_blocked_slots" USING "btree" ("medico_id");


CREATE INDEX "idx_booking_notification_deliveries_booking_id" ON "public"."booking_notification_deliveries" USING "btree" ("booking_id");


CREATE INDEX "idx_booking_notification_deliveries_recipient" ON "public"."booking_notification_deliveries" USING "btree" ("recipient_user_id");


CREATE INDEX "idx_booking_notification_deliveries_status_due" ON "public"."booking_notification_deliveries" USING "btree" ("status", "due_at");


CREATE INDEX "idx_booking_settings_created_at" ON "public"."booking_settings" USING "btree" ("created_at");


CREATE INDEX "idx_bookings_cliente_id" ON "public"."bookings" USING "btree" ("cliente_id");


CREATE INDEX "idx_bookings_company_id" ON "public"."bookings" USING "btree" ("company_id");


CREATE INDEX "idx_bookings_company_room_date" ON "public"."bookings" USING "btree" ("company_id", "room_id", "date") WHERE ("room_id" IS NOT NULL);


CREATE INDEX "idx_bookings_date" ON "public"."bookings" USING "btree" ("date");


CREATE INDEX "idx_bookings_medico_id" ON "public"."bookings" USING "btree" ("medico_id");


CREATE INDEX "idx_bookings_points" ON "public"."bookings" USING "btree" ("points") WHERE ("points" IS NOT NULL);


CREATE INDEX "idx_bookings_room_id" ON "public"."bookings" USING "btree" ("room_id");


CREATE INDEX "idx_bookings_service_id_fk" ON "public"."bookings" USING "btree" ("service_id");


CREATE INDEX "idx_commerciale_rewards_cliente_id" ON "public"."commerciale_rewards" USING "btree" ("cliente_id");


CREATE INDEX "idx_commerciale_rewards_commerciale_id" ON "public"."commerciale_rewards" USING "btree" ("commerciale_id");


CREATE INDEX "idx_commerciale_rewards_status" ON "public"."commerciale_rewards" USING "btree" ("status");


CREATE INDEX "idx_company_clients_added_by_fk" ON "public"."company_clients" USING "btree" ("added_by");


CREATE INDEX "idx_company_clients_ownership" ON "public"."company_clients" USING "btree" ("company_id", "ownership_type") WHERE ("is_active" = true);


CREATE INDEX "idx_company_clients_referred_by" ON "public"."company_clients" USING "btree" ("referred_by", "company_id") WHERE ("is_active" = true);


CREATE INDEX "idx_company_clients_referred_by_fk" ON "public"."company_clients" USING "btree" ("referred_by");


CREATE INDEX "idx_company_commerciale_links_commerciale_id" ON "public"."company_commerciale_links" USING "btree" ("commerciale_id");


CREATE INDEX "idx_company_commerciale_links_company_id" ON "public"."company_commerciale_links" USING "btree" ("company_id");


CREATE INDEX "idx_company_commerciale_links_expires_at" ON "public"."company_commerciale_links" USING "btree" ("expires_at");


CREATE INDEX "idx_company_contacts_shared_by_fk" ON "public"."company_contacts" USING "btree" ("shared_by");


CREATE INDEX "idx_company_member_invites_accepted_by_fk" ON "public"."company_member_invites" USING "btree" ("accepted_by");


CREATE INDEX "idx_company_member_invites_invited_by_fk" ON "public"."company_member_invites" USING "btree" ("invited_by");


CREATE INDEX "idx_company_member_invites_user_id_fk" ON "public"."company_member_invites" USING "btree" ("user_id");


CREATE INDEX "idx_company_rooms_company_id" ON "public"."company_rooms" USING "btree" ("company_id", "is_active");


CREATE INDEX "idx_company_rooms_professional_user_ids" ON "public"."company_rooms" USING "gin" ("professional_user_ids");


CREATE INDEX "idx_company_service_catalog_consent_template_id_fk" ON "public"."company_service_catalog" USING "btree" ("consent_template_id");


CREATE INDEX "idx_company_service_catalog_professional_id_fk" ON "public"."company_service_catalog" USING "btree" ("professional_id");


CREATE INDEX "idx_company_service_catalog_service_id_fk" ON "public"."company_service_catalog" USING "btree" ("service_id");


CREATE INDEX "idx_company_service_requests_requested_by_fk" ON "public"."company_service_requests" USING "btree" ("requested_by");


CREATE INDEX "idx_company_service_requests_responded_by_fk" ON "public"."company_service_requests" USING "btree" ("responded_by");


CREATE INDEX "idx_company_service_requests_service_id_fk" ON "public"."company_service_requests" USING "btree" ("service_id");


CREATE INDEX "idx_consent_audit_logs_actor_id_fk" ON "public"."consent_audit_logs" USING "btree" ("actor_id");


CREATE INDEX "idx_consent_audit_logs_consent_id" ON "public"."consent_audit_logs" USING "btree" ("consent_id");


CREATE INDEX "idx_consent_audit_logs_created_at" ON "public"."consent_audit_logs" USING "btree" ("created_at");


CREATE INDEX "idx_consent_audit_logs_event_type" ON "public"."consent_audit_logs" USING "btree" ("event_type");


CREATE INDEX "idx_consent_audit_logs_version_id_fk" ON "public"."consent_audit_logs" USING "btree" ("version_id");


CREATE INDEX "idx_consent_document_versions_created_by_fk" ON "public"."consent_document_versions" USING "btree" ("created_by");


CREATE INDEX "idx_consent_document_versions_number" ON "public"."consent_document_versions" USING "btree" ("consent_id", "version_number");


CREATE INDEX "idx_consent_documents_client_id" ON "public"."consent_documents" USING "btree" ("client_id");


CREATE INDEX "idx_consent_documents_current_version_id_fk" ON "public"."consent_documents" USING "btree" ("current_version_id");


CREATE INDEX "idx_consent_documents_professional_id" ON "public"."consent_documents" USING "btree" ("professional_id");


CREATE INDEX "idx_consent_documents_status" ON "public"."consent_documents" USING "btree" ("status");


CREATE INDEX "idx_consent_documents_template_id_fk" ON "public"."consent_documents" USING "btree" ("template_id");


CREATE INDEX "idx_consent_documents_treatment_id" ON "public"."consent_documents" USING "btree" ("treatment_id");


CREATE INDEX "idx_consent_documents_updated_at" ON "public"."consent_documents" USING "btree" ("updated_at");


CREATE INDEX "idx_consent_share_tokens_client_id" ON "public"."consent_share_tokens" USING "btree" ("client_id");


CREATE INDEX "idx_consent_share_tokens_consent_id" ON "public"."consent_share_tokens" USING "btree" ("consent_id");


CREATE INDEX "idx_consent_share_tokens_expires_at" ON "public"."consent_share_tokens" USING "btree" ("expires_at");


CREATE INDEX "idx_consent_share_tokens_professional_id_fk" ON "public"."consent_share_tokens" USING "btree" ("professional_id");


CREATE INDEX "idx_consent_share_tokens_treatment_id_fk" ON "public"."consent_share_tokens" USING "btree" ("treatment_id");


CREATE INDEX "idx_consent_signatures_consent_id" ON "public"."consent_signatures" USING "btree" ("consent_id");


CREATE INDEX "idx_consent_signatures_created_at" ON "public"."consent_signatures" USING "btree" ("created_at");


CREATE INDEX "idx_consent_signatures_signer_id" ON "public"."consent_signatures" USING "btree" ("signer_id");


CREATE INDEX "idx_consent_signatures_version_id_fk" ON "public"."consent_signatures" USING "btree" ("version_id");


CREATE INDEX "idx_consent_templates_active" ON "public"."consent_templates" USING "btree" ("owner_id", "is_active");


CREATE INDEX "idx_consent_templates_company_id" ON "public"."consent_templates" USING "btree" ("company_id");


CREATE INDEX "idx_consent_templates_owner_active_updated_desc" ON "public"."consent_templates" USING "btree" ("owner_id", "is_active", "updated_at" DESC);


CREATE INDEX "idx_consent_templates_owner_id" ON "public"."consent_templates" USING "btree" ("owner_id");


CREATE INDEX "idx_consent_templates_owner_type_active_updated_desc" ON "public"."consent_templates" USING "btree" ("owner_type", "is_active", "updated_at" DESC);


CREATE INDEX "idx_contacts_codice_fiscale" ON "public"."contacts" USING "btree" ("codice_fiscale");


CREATE INDEX "idx_contacts_email" ON "public"."contacts" USING "btree" ("email");


CREATE INDEX "idx_contacts_linked_user_id_fk" ON "public"."contacts" USING "btree" ("linked_user_id");


CREATE INDEX "idx_contacts_owner_id" ON "public"."contacts" USING "btree" ("owner_id");


CREATE INDEX "idx_contacts_trash_deleted_at" ON "public"."contacts_trash" USING "btree" ("deleted_at");


CREATE INDEX "idx_contacts_trash_owner_id" ON "public"."contacts_trash" USING "btree" ("owner_id");


CREATE INDEX "idx_coupons_cliente_id_fk" ON "public"."coupons" USING "btree" ("cliente_id");


CREATE INDEX "idx_coupons_company_active" ON "public"."coupons" USING "btree" ("company_id", "status", "valid_until") WHERE ("company_id" IS NOT NULL);


CREATE INDEX "idx_coupons_company_id_fk" ON "public"."coupons" USING "btree" ("company_id");


CREATE INDEX "idx_coupons_medico_id" ON "public"."coupons" USING "btree" ("medico_id");


CREATE INDEX "idx_coupons_personal_medico_active" ON "public"."coupons" USING "btree" ("medico_id", "status", "valid_until") WHERE ("company_id" IS NULL);


CREATE INDEX "idx_coupons_premium_tier" ON "public"."coupons" USING "btree" ("premium_tier") WHERE ("premium_tier" IS NOT NULL);


CREATE INDEX "idx_coupons_scope" ON "public"."coupons" USING "btree" ("scope");


CREATE INDEX "idx_coupons_status" ON "public"."coupons" USING "btree" ("status");


CREATE INDEX "idx_coupons_target_entity" ON "public"."coupons" USING "btree" ("target_entity_type", "target_entity_id");


CREATE INDEX "idx_credibility_audit_events_actor_id_fk" ON "public"."credibility_audit_events" USING "btree" ("actor_id");


CREATE INDEX "idx_credibility_audit_events_check_id_fk" ON "public"."credibility_audit_events" USING "btree" ("check_id");


CREATE INDEX "idx_credibility_audit_operator_id" ON "public"."credibility_audit_events" USING "btree" ("operator_id");


CREATE INDEX "idx_credibility_checks_operator_id" ON "public"."credibility_checks" USING "btree" ("operator_id");


CREATE INDEX "idx_credibility_checks_status" ON "public"."credibility_checks" USING "btree" ("status");


CREATE INDEX "idx_credibility_documents_status" ON "public"."credibility_documents" USING "btree" ("verification_status");


CREATE INDEX "idx_credibility_documents_user_id" ON "public"."credibility_documents" USING "btree" ("user_id");


CREATE INDEX "idx_credibility_issues_status" ON "public"."credibility_issues" USING "btree" ("status");


CREATE INDEX "idx_credibility_issues_user_id" ON "public"."credibility_issues" USING "btree" ("user_id");


CREATE INDEX "idx_credibility_mentions_check_id" ON "public"."credibility_mentions" USING "btree" ("check_id");


CREATE INDEX "idx_credibility_mentions_operator_id_fk" ON "public"."credibility_mentions" USING "btree" ("operator_id");


CREATE INDEX "idx_credibility_reviews_check_id" ON "public"."credibility_reviews" USING "btree" ("check_id");


CREATE INDEX "idx_credibility_reviews_operator_id_fk" ON "public"."credibility_reviews" USING "btree" ("operator_id");


CREATE INDEX "idx_credibility_scores_operator_id_fk" ON "public"."credibility_scores" USING "btree" ("operator_id");


CREATE INDEX "idx_csc_company_active" ON "public"."company_service_catalog" USING "btree" ("company_id") WHERE ("is_active" = true);


CREATE INDEX "idx_csr_company" ON "public"."company_service_requests" USING "btree" ("company_id", "status");


CREATE INDEX "idx_csr_professional" ON "public"."company_service_requests" USING "btree" ("professional_id", "status");


CREATE INDEX "idx_custom_services_company" ON "public"."custom_services" USING "btree" ("company_id") WHERE ("company_id" IS NOT NULL);


CREATE INDEX "idx_custom_services_company_id_fk" ON "public"."custom_services" USING "btree" ("company_id");


CREATE INDEX "idx_custom_services_contributed_by_fk" ON "public"."custom_services" USING "btree" ("contributed_by");


CREATE INDEX "idx_custom_services_is_active" ON "public"."custom_services" USING "btree" ("is_active");


CREATE INDEX "idx_custom_services_medico_id" ON "public"."custom_services" USING "btree" ("medico_id");


CREATE INDEX "idx_custom_services_source_service_id_fk" ON "public"."custom_services" USING "btree" ("source_service_id");


CREATE INDEX "idx_editorial_articles_approved_by_fk" ON "public"."editorial_articles" USING "btree" ("approved_by");


CREATE INDEX "idx_editorial_articles_created_by_fk" ON "public"."editorial_articles" USING "btree" ("created_by");


CREATE INDEX "idx_editorial_articles_trend_cluster_id_fk" ON "public"."editorial_articles" USING "btree" ("trend_cluster_id");


CREATE INDEX "idx_editorial_audit_events_actor_user_id_fk" ON "public"."editorial_audit_events" USING "btree" ("actor_user_id");


CREATE INDEX "idx_editorial_homepage_slots_created_by_fk" ON "public"."editorial_homepage_slots" USING "btree" ("created_by");


CREATE INDEX "idx_editorial_publications_article_id_fk" ON "public"."editorial_publications" USING "btree" ("article_id");


CREATE INDEX "idx_editorial_publications_created_by_fk" ON "public"."editorial_publications" USING "btree" ("created_by");


CREATE INDEX "idx_editorial_user_events_article_id_fk" ON "public"."editorial_user_events" USING "btree" ("article_id");


CREATE INDEX "idx_email_audit_log_created_at" ON "public"."email_audit_log" USING "btree" ("created_at" DESC);


CREATE INDEX "idx_email_audit_log_invite_id" ON "public"."email_audit_log" USING "btree" ("invite_id");


CREATE INDEX "idx_email_audit_log_message_id" ON "public"."email_audit_log" USING "btree" ("message_id");


CREATE INDEX "idx_email_audit_log_provider" ON "public"."email_audit_log" USING "btree" ("provider");


CREATE INDEX "idx_email_audit_log_provider_message_id" ON "public"."email_audit_log" USING "btree" ("provider_message_id");


CREATE INDEX "idx_email_audit_log_recipient" ON "public"."email_audit_log" USING "btree" ("recipient_email");


CREATE INDEX "idx_email_audit_log_sent_at" ON "public"."email_audit_log" USING "btree" ("sent_at" DESC);


CREATE INDEX "idx_email_audit_log_status" ON "public"."email_audit_log" USING "btree" ("status");


CREATE INDEX "idx_email_audit_log_triggered_by_user_id_fk" ON "public"."email_audit_log" USING "btree" ("triggered_by_user_id");


CREATE INDEX "idx_email_events_audit_log_id" ON "public"."email_events" USING "btree" ("audit_log_id");


CREATE INDEX "idx_email_events_occurred_at" ON "public"."email_events" USING "btree" ("occurred_at" DESC);


CREATE INDEX "idx_email_events_type" ON "public"."email_events" USING "btree" ("event_type");


CREATE INDEX "idx_email_forwards_audit_log_id" ON "public"."email_forwards" USING "btree" ("audit_log_id");


CREATE INDEX "idx_email_forwards_forwarded_by" ON "public"."email_forwards" USING "btree" ("forwarded_by_user_id");


CREATE INDEX "idx_email_suppressions_unsuppressed_by_fk" ON "public"."email_suppressions" USING "btree" ("unsuppressed_by");


CREATE INDEX "idx_finance_installment_plans_provider_ref_created_desc" ON "public"."finance_installment_plans" USING "btree" ("provider", "provider_plan_ref", "created_at" DESC);


CREATE INDEX "idx_finance_installment_plans_status" ON "public"."finance_installment_plans" USING "btree" ("status");


CREATE INDEX "idx_finance_installment_plans_user_id" ON "public"."finance_installment_plans" USING "btree" ("user_id");


CREATE INDEX "idx_finance_installment_plans_user_status_updated_desc" ON "public"."finance_installment_plans" USING "btree" ("user_id", "status", "updated_at" DESC);


CREATE INDEX "idx_finance_invoice_jobs_receipt_status_created_desc" ON "public"."finance_invoice_jobs" USING "btree" ("receipt_id", "status", "created_at" DESC);


CREATE INDEX "idx_finance_invoice_jobs_status_created_asc" ON "public"."finance_invoice_jobs" USING "btree" ("status", "created_at");


CREATE INDEX "idx_finance_ledger_entries_entry_type" ON "public"."finance_ledger_entries" USING "btree" ("entry_type");


CREATE INDEX "idx_finance_ledger_entries_transaction_id" ON "public"."finance_ledger_entries" USING "btree" ("transaction_id");


CREATE INDEX "idx_finance_ledger_entries_user_id" ON "public"."finance_ledger_entries" USING "btree" ("user_id");


CREATE INDEX "idx_finance_payment_sessions_entity_status_created_desc" ON "public"."finance_payment_sessions" USING "btree" ("entity_type", "entity_id", "status", "created_at" DESC);


CREATE INDEX "idx_finance_payment_sessions_provider_ref" ON "public"."finance_payment_sessions" USING "btree" ("provider", "checkout_session_ref");


CREATE INDEX "idx_finance_payment_sessions_settled_treatment_entity" ON "public"."finance_payment_sessions" USING "btree" ("entity_id") WHERE (("entity_type" = 'treatment'::"text") AND ("status" = 'settled'::"public"."finance_status"));


CREATE INDEX "idx_finance_payment_sessions_status" ON "public"."finance_payment_sessions" USING "btree" ("status");


CREATE INDEX "idx_finance_payment_sessions_user_created_desc" ON "public"."finance_payment_sessions" USING "btree" ("user_id", "created_at" DESC);


CREATE INDEX "idx_finance_payment_sessions_user_id" ON "public"."finance_payment_sessions" USING "btree" ("user_id");


CREATE INDEX "idx_finance_payout_batches_approved_by_fk" ON "public"."finance_payout_batches" USING "btree" ("approved_by");


CREATE INDEX "idx_finance_payout_batches_created_desc" ON "public"."finance_payout_batches" USING "btree" ("created_at" DESC);


CREATE INDEX "idx_finance_payout_batches_status" ON "public"."finance_payout_batches" USING "btree" ("status");


CREATE INDEX "idx_finance_payout_items_batch_status" ON "public"."finance_payout_items" USING "btree" ("batch_id", "status");


CREATE INDEX "idx_finance_payout_items_source_ref" ON "public"."finance_payout_items" USING "btree" ("source_ref");


CREATE INDEX "idx_finance_payout_items_status_due_at" ON "public"."finance_payout_items" USING "btree" ("status", "due_at");


CREATE INDEX "idx_finance_payout_items_user_created_desc" ON "public"."finance_payout_items" USING "btree" ("user_id", "created_at" DESC);


CREATE INDEX "idx_finance_payout_items_user_id" ON "public"."finance_payout_items" USING "btree" ("user_id");


CREATE INDEX "idx_finance_provider_events_processed" ON "public"."finance_provider_events" USING "btree" ("processed", "created_at" DESC);


CREATE INDEX "idx_finance_receipts_issuer_user_id_fk" ON "public"."finance_receipts" USING "btree" ("issuer_user_id");


CREATE INDEX "idx_finance_receipts_status" ON "public"."finance_receipts" USING "btree" ("status");


CREATE INDEX "idx_finance_receipts_user_created_desc" ON "public"."finance_receipts" USING "btree" ("user_id", "created_at" DESC);


CREATE INDEX "idx_finance_receipts_user_id" ON "public"."finance_receipts" USING "btree" ("user_id");


CREATE INDEX "idx_finance_transactions_status" ON "public"."finance_transactions" USING "btree" ("status");


CREATE INDEX "idx_finance_transactions_user_created_desc" ON "public"."finance_transactions" USING "btree" ("user_id", "created_at" DESC);


CREATE INDEX "idx_finance_transactions_user_id" ON "public"."finance_transactions" USING "btree" ("user_id");


CREATE INDEX "idx_forensic_audit_actor" ON "public"."forensic_audit_log" USING "btree" ("actor_id");


CREATE INDEX "idx_forensic_audit_created_at" ON "public"."forensic_audit_log" USING "btree" ("created_at");


CREATE INDEX "idx_forensic_audit_entity" ON "public"."forensic_audit_log" USING "btree" ("entity_type", "entity_id");


CREATE INDEX "idx_forensic_audit_log_integrity_record_id_fk" ON "public"."forensic_audit_log" USING "btree" ("integrity_record_id");


CREATE INDEX "idx_forensic_audit_logs_created_at" ON "public"."forensic_audit_logs" USING "btree" ("created_at");


CREATE INDEX "idx_forensic_audit_logs_entity" ON "public"."forensic_audit_logs" USING "btree" ("entity_type", "entity_id");


CREATE INDEX "idx_forensic_document_integrity_document_id" ON "public"."forensic_document_integrity" USING "btree" ("document_id");


CREATE INDEX "idx_forensic_document_integrity_status" ON "public"."forensic_document_integrity" USING "btree" ("integrity_status");


CREATE INDEX "idx_forensic_integrity_anchor_type" ON "public"."forensic_integrity_records" USING "btree" ("anchor_type");


CREATE INDEX "idx_forensic_integrity_entity" ON "public"."forensic_integrity_records" USING "btree" ("entity_type", "entity_id");


CREATE INDEX "idx_forensic_integrity_hash" ON "public"."forensic_integrity_records" USING "btree" ("content_hash");


CREATE INDEX "idx_forum_flags_post_id_fk" ON "public"."forum_flags" USING "btree" ("post_id");


CREATE INDEX "idx_forum_flags_status" ON "public"."forum_flags" USING "btree" ("status");


CREATE INDEX "idx_forum_flags_thread_id_fk" ON "public"."forum_flags" USING "btree" ("thread_id");


CREATE INDEX "idx_forum_posts_parent_post_id_fk" ON "public"."forum_posts" USING "btree" ("parent_post_id");


CREATE INDEX "idx_forum_posts_thread" ON "public"."forum_posts" USING "btree" ("thread_id") WHERE ("status" = 'published'::"text");


CREATE INDEX "idx_forum_posts_thread_id_fk" ON "public"."forum_posts" USING "btree" ("thread_id");


CREATE INDEX "idx_forum_posts_user" ON "public"."forum_posts" USING "btree" ("user_id");


CREATE INDEX "idx_forum_threads_category" ON "public"."forum_threads" USING "btree" ("category_id") WHERE ("status" = 'published'::"text");


CREATE INDEX "idx_forum_threads_category_id_fk" ON "public"."forum_threads" USING "btree" ("category_id");


CREATE INDEX "idx_forum_threads_created" ON "public"."forum_threads" USING "btree" ("created_at" DESC);


CREATE INDEX "idx_forum_threads_user" ON "public"."forum_threads" USING "btree" ("user_id");


CREATE INDEX "idx_gallery_items_cliente_id" ON "public"."gallery_items" USING "btree" ("cliente_id");


CREATE INDEX "idx_gallery_items_deleted_at" ON "public"."gallery_items" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);


CREATE INDEX "idx_gallery_items_deleted_by_fk" ON "public"."gallery_items" USING "btree" ("deleted_by");


CREATE INDEX "idx_gallery_items_is_public" ON "public"."gallery_items" USING "btree" ("is_public");


CREATE INDEX "idx_gallery_items_medico_id" ON "public"."gallery_items" USING "btree" ("medico_id");


CREATE INDEX "idx_gallery_items_status" ON "public"."gallery_items" USING "btree" ("status");


CREATE INDEX "idx_gallery_likes_item_id" ON "public"."gallery_likes" USING "btree" ("item_id");


CREATE INDEX "idx_gallery_likes_user_id" ON "public"."gallery_likes" USING "btree" ("user_id");


CREATE INDEX "idx_insurance_daily_report_log_status" ON "public"."insurance_daily_report_log" USING "btree" ("status");


CREATE INDEX "idx_insurance_manual_reg_finance_session" ON "public"."insurance_manual_registrations" USING "btree" ("finance_session_id");


CREATE INDEX "idx_insurance_manual_reg_payment_id" ON "public"."insurance_manual_registrations" USING "btree" ("premium_payment_id");


CREATE INDEX "idx_insurance_manual_reg_pending" ON "public"."insurance_manual_registrations" USING "btree" ("registered_at") WHERE ("registered_at" IS NULL);


CREATE INDEX "idx_insurance_manual_reg_user_id" ON "public"."insurance_manual_registrations" USING "btree" ("user_id");


CREATE INDEX "idx_insurance_manual_registrations_registered_by_admin_id_fk" ON "public"."insurance_manual_registrations" USING "btree" ("registered_by_admin_id");


CREATE INDEX "idx_invites_commerciale_id" ON "public"."invites" USING "btree" ("commerciale_id");


CREATE INDEX "idx_invites_company_id" ON "public"."invites" USING "btree" ("company_id");


CREATE INDEX "idx_invites_status" ON "public"."invites" USING "btree" ("status");


CREATE INDEX "idx_invites_used_by_fk" ON "public"."invites" USING "btree" ("used_by");


CREATE INDEX "idx_invites_user_id_fk" ON "public"."invites" USING "btree" ("user_id");


CREATE INDEX "idx_legal_audit_consent" ON "public"."legal_consent_audit_logs" USING "btree" ("consent_template_id");


CREATE INDEX "idx_legal_audit_user" ON "public"."legal_consent_audit_logs" USING "btree" ("user_id");


CREATE INDEX "idx_logs_created_at" ON "public"."event_logs" USING "btree" ("created_at" DESC);


CREATE INDEX "idx_logs_type" ON "public"."event_logs" USING "btree" ("type");


CREATE INDEX "idx_logs_user_id" ON "public"."event_logs" USING "btree" ("user_id");


CREATE INDEX "idx_loyalty_credits_patient" ON "public"."loyalty_credits_ledger" USING "btree" ("patient_id");


CREATE INDEX "idx_loyalty_credits_sub_month" ON "public"."loyalty_credits_ledger" USING "btree" ("subscription_id", "month_key");


CREATE UNIQUE INDEX "idx_loyalty_credits_unique_booking_consumed" ON "public"."loyalty_credits_ledger" USING "btree" ("subscription_id", "booking_id") WHERE (("reason" = 'booking_consumed'::"text") AND ("booking_id" IS NOT NULL));


CREATE UNIQUE INDEX "idx_loyalty_credits_unique_monthly_rollover" ON "public"."loyalty_credits_ledger" USING "btree" ("subscription_id", "month_key") WHERE ("reason" = 'rollover'::"text");


CREATE INDEX "idx_loyalty_program_terms_acceptances_accepted_by_fk" ON "public"."loyalty_program_terms_acceptances" USING "btree" ("accepted_by");


CREATE INDEX "idx_loyalty_subscriptions_owner" ON "public"."loyalty_subscriptions" USING "btree" ("owner_type", "owner_id", "status");


CREATE INDEX "idx_loyalty_subscriptions_patient" ON "public"."loyalty_subscriptions" USING "btree" ("patient_id", "status");


CREATE INDEX "idx_message_messages_created_at" ON "public"."message_messages" USING "btree" ("created_at" DESC);


CREATE INDEX "idx_message_messages_sender_id" ON "public"."message_messages" USING "btree" ("sender_id");


CREATE INDEX "idx_message_messages_thread_id" ON "public"."message_messages" USING "btree" ("thread_id");


CREATE INDEX "idx_message_threads_participant_ids" ON "public"."message_threads" USING "gin" ("participant_ids");


CREATE INDEX "idx_message_threads_updated_at" ON "public"."message_threads" USING "btree" ("updated_at" DESC);


CREATE INDEX "idx_otps_email" ON "public"."otps" USING "btree" ("email");


CREATE INDEX "idx_otps_expires_at" ON "public"."otps" USING "btree" ("expires_at");


CREATE INDEX "idx_otps_user_id_fk" ON "public"."otps" USING "btree" ("user_id");


CREATE INDEX "idx_patient_professional_links_invited_by_fk" ON "public"."patient_professional_links" USING "btree" ("invited_by");


CREATE INDEX "idx_payment_accounts_company_id_fk" ON "public"."payment_accounts" USING "btree" ("company_id");


CREATE INDEX "idx_payment_accounts_user_id_fk" ON "public"."payment_accounts" USING "btree" ("user_id");


CREATE INDEX "idx_platform_logs_action_trgm" ON "public"."platform_logs" USING "gin" ("action" "public"."gin_trgm_ops");


CREATE INDEX "idx_platform_logs_details_text_trgm" ON "public"."platform_logs" USING "gin" ("details_text" "public"."gin_trgm_ops");


CREATE INDEX "idx_platform_logs_message_trgm" ON "public"."platform_logs" USING "gin" ("message" "public"."gin_trgm_ops");


CREATE INDEX "idx_platform_logs_user_email_trgm" ON "public"."platform_logs" USING "gin" ("user_email" "public"."gin_trgm_ops");


CREATE INDEX "idx_platform_logs_user_role_trgm" ON "public"."platform_logs" USING "gin" ("user_role" "public"."gin_trgm_ops");


CREATE INDEX "idx_platform_settings_updated_by_fk" ON "public"."platform_settings" USING "btree" ("updated_by");


CREATE INDEX "idx_points_ledger_company_id_fk" ON "public"."points_ledger" USING "btree" ("company_id");


CREATE INDEX "idx_points_ledger_created_at" ON "public"."points_ledger" USING "btree" ("created_at");


CREATE INDEX "idx_points_ledger_created_by_fk" ON "public"."points_ledger" USING "btree" ("created_by");


CREATE INDEX "idx_points_ledger_ref" ON "public"."points_ledger" USING "btree" ("ref_type", "ref_id");


CREATE INDEX "idx_points_ledger_user_id" ON "public"."points_ledger" USING "btree" ("user_id");


CREATE INDEX "idx_points_transactions_user_id_fk" ON "public"."points_transactions" USING "btree" ("user_id");


CREATE INDEX "idx_ppl_patient_id" ON "public"."patient_professional_links" USING "btree" ("patient_id");


CREATE INDEX "idx_ppl_professional_id" ON "public"."patient_professional_links" USING "btree" ("professional_id");


CREATE INDEX "idx_ppl_status" ON "public"."patient_professional_links" USING "btree" ("status");


CREATE INDEX "idx_premium_payments_subscription_id" ON "public"."premium_payments" USING "btree" ("subscription_id");


CREATE INDEX "idx_premium_payments_user_id" ON "public"."premium_payments" USING "btree" ("user_id");


CREATE INDEX "idx_premium_renewal_reminders_status" ON "public"."premium_renewal_reminders" USING "btree" ("status");


CREATE INDEX "idx_premium_renewal_reminders_term_end" ON "public"."premium_renewal_reminders" USING "btree" ("term_end");


CREATE INDEX "idx_premium_renewal_reminders_user_id" ON "public"."premium_renewal_reminders" USING "btree" ("user_id");


CREATE INDEX "idx_premium_subscriptions_status" ON "public"."premium_subscriptions" USING "btree" ("status");


CREATE INDEX "idx_premium_subscriptions_user_id" ON "public"."premium_subscriptions" USING "btree" ("user_id");


CREATE INDEX "idx_prof_catalog_active" ON "public"."professional_catalog_items" USING "btree" ("professional_id", "is_active");


CREATE INDEX "idx_prof_catalog_custom_id" ON "public"."professional_catalog_items" USING "btree" ("custom_service_id");


CREATE INDEX "idx_prof_catalog_disclaimer" ON "public"."professional_catalog_items" USING "btree" ("professional_id", "disclaimer_accepted");


CREATE INDEX "idx_prof_catalog_disclaimer_accepted_by_fk" ON "public"."professional_catalog_items" USING "btree" ("disclaimer_accepted_by");


CREATE INDEX "idx_prof_catalog_disclaimer_by" ON "public"."professional_catalog_items" USING "btree" ("professional_id", "disclaimer_accepted_by");


CREATE INDEX "idx_prof_catalog_items_consent_template_id_fk" ON "public"."professional_catalog_items" USING "btree" ("consent_template_id");


CREATE INDEX "idx_prof_catalog_platform_id" ON "public"."professional_catalog_items" USING "btree" ("platform_treatment_id");


CREATE INDEX "idx_prof_catalog_professional" ON "public"."professional_catalog_items" USING "btree" ("professional_id");


CREATE INDEX "idx_prof_catalog_professional_deleted" ON "public"."professional_catalog_items" USING "btree" ("professional_id", "is_deleted", "updated_at");


CREATE INDEX "idx_prof_offered_treatments_active" ON "public"."professional_offered_treatments" USING "btree" ("professional_id", "is_active");


CREATE INDEX "idx_prof_offered_treatments_treatment" ON "public"."professional_offered_treatments" USING "btree" ("platform_treatment_id");


CREATE INDEX "idx_professional_contract_renewal_reminders_renewal_at" ON "public"."professional_contract_renewal_reminders" USING "btree" ("renewal_at");


CREATE INDEX "idx_professional_contract_renewal_reminders_status" ON "public"."professional_contract_renewal_reminders" USING "btree" ("status");


CREATE INDEX "idx_professional_contract_renewal_reminders_user_id" ON "public"."professional_contract_renewal_reminders" USING "btree" ("user_id");


CREATE INDEX "idx_referral_codes_user_id_fk" ON "public"."referral_codes" USING "btree" ("user_id");


CREATE INDEX "idx_referral_commissions_referral_id_fk" ON "public"."referral_commissions" USING "btree" ("referral_id");


CREATE INDEX "idx_referrals_company_id" ON "public"."referrals" USING "btree" ("company_id");


CREATE INDEX "idx_referrals_professional_id_fk" ON "public"."referrals" USING "btree" ("professional_id");


CREATE INDEX "idx_referrals_referred_id_fk" ON "public"."referrals" USING "btree" ("referred_id");


CREATE INDEX "idx_referrals_referred_premium_reward" ON "public"."referrals" USING "btree" ("referred_id", "premium_rewarded_at");


CREATE INDEX "idx_referrals_referrer_id_fk" ON "public"."referrals" USING "btree" ("referrer_id");


CREATE INDEX "idx_subscriptions_user_id_fk" ON "public"."subscriptions" USING "btree" ("user_id");


CREATE INDEX "idx_treatments_booking" ON "public"."treatments" USING "btree" ("booking_id");


CREATE INDEX "idx_treatments_company_id" ON "public"."treatments" USING "btree" ("company_id");


CREATE INDEX "idx_treatments_company_medico" ON "public"."treatments" USING "btree" ("company_id", "medico_id") WHERE ("company_id" IS NOT NULL);


CREATE INDEX "idx_treatments_date" ON "public"."treatments" USING "btree" ("date");


CREATE INDEX "idx_treatments_medico_id" ON "public"."treatments" USING "btree" ("medico_id");


CREATE INDEX "idx_treatments_room_id" ON "public"."treatments" USING "btree" ("room_id");


CREATE INDEX "idx_treatments_service_id_fk" ON "public"."treatments" USING "btree" ("service_id");


CREATE INDEX "idx_treatments_status" ON "public"."treatments" USING "btree" ("status");


CREATE INDEX "idx_treatments_user_id" ON "public"."treatments" USING "btree" ("user_id");


CREATE INDEX "idx_trend_cluster_items_normalized_content_item_id_fk" ON "public"."trend_cluster_items" USING "btree" ("normalized_content_item_id");


CREATE INDEX "idx_user_deletion_requests_cancelled_by_fk" ON "public"."user_deletion_requests" USING "btree" ("cancelled_by");


CREATE INDEX "idx_user_deletion_requests_pec_confirmation_by_fk" ON "public"."user_deletion_requests" USING "btree" ("pec_confirmation_by");


CREATE INDEX "idx_user_deletion_requests_requested_by_fk" ON "public"."user_deletion_requests" USING "btree" ("requested_by");


CREATE INDEX "idx_user_deletion_requests_status" ON "public"."user_deletion_requests" USING "btree" ("status", "scheduled_purge_at");


CREATE INDEX "idx_user_deletion_requests_token" ON "public"."user_deletion_requests" USING "btree" ("confirmation_token_hash") WHERE ("confirmation_token_hash" IS NOT NULL);


CREATE INDEX "idx_user_deletion_requests_user_id_fk" ON "public"."user_deletion_requests" USING "btree" ("user_id");


CREATE INDEX "idx_users_codice_commerciale" ON "public"."users" USING "btree" ("codice_commerciale");


CREATE INDEX "idx_users_codice_medico" ON "public"."users" USING "btree" ("codice_medico");


CREATE INDEX "idx_users_medico_riferimento" ON "public"."users" USING "btree" ("medico_riferimento_id");


CREATE INDEX "idx_users_tipo_utente" ON "public"."users" USING "btree" ("tipo_utente");


CREATE INDEX "idx_verification_documents_file_hash" ON "public"."verification_documents" USING "btree" ("file_hash");


CREATE INDEX "idx_verification_documents_integrity_status" ON "public"."verification_documents" USING "btree" ("integrity_status");


CREATE INDEX "idx_verification_documents_verification_id_fk" ON "public"."verification_documents" USING "btree" ("verification_id");


CREATE INDEX "idx_wallet_transactions_expires_at" ON "public"."wallet_transactions" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);


CREATE INDEX "idx_wallet_transactions_user_id_fk" ON "public"."wallet_transactions" USING "btree" ("user_id");


CREATE INDEX "idx_wallet_transactions_wallet_id_fk" ON "public"."wallet_transactions" USING "btree" ("wallet_id");


CREATE INDEX "invites_user_id_idx" ON "public"."invites" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);


CREATE INDEX "ix_editorial_articles_published_at" ON "public"."editorial_articles" USING "btree" ("published_at" DESC);


CREATE INDEX "ix_editorial_articles_status_created" ON "public"."editorial_articles" USING "btree" ("status", "created_at" DESC);


CREATE INDEX "ix_editorial_articles_topic" ON "public"."editorial_articles" USING "btree" ("topic");


CREATE INDEX "ix_editorial_audit_entity" ON "public"."editorial_audit_events" USING "btree" ("entity_type", "entity_id", "created_at" DESC);


CREATE INDEX "ix_editorial_homepage_slots_article" ON "public"."editorial_homepage_slots" USING "btree" ("article_id");


CREATE INDEX "ix_editorial_homepage_slots_scope_active" ON "public"."editorial_homepage_slots" USING "btree" ("target_scope", "status", "starts_at", "ends_at");


CREATE INDEX "ix_editorial_publications_dispatch" ON "public"."editorial_publications" USING "btree" ("status", "scheduled_at", "channel");


CREATE INDEX "ix_editorial_publications_status_scheduled" ON "public"."editorial_publications" USING "btree" ("status", "scheduled_at");


CREATE INDEX "ix_editorial_user_events_user_event_at" ON "public"."editorial_user_events" USING "btree" ("user_id", "event_at" DESC);


CREATE INDEX "ix_trend_clusters_confidence" ON "public"."trend_clusters" USING "btree" ("confidence_score" DESC);


CREATE INDEX "ix_trend_clusters_topic_stage" ON "public"."trend_clusters" USING "btree" ("topic", "lifecycle_stage");


CREATE INDEX "ix_trend_scores_computed_at" ON "public"."trend_scores" USING "btree" ("computed_at" DESC);


CREATE INDEX "ix_trend_scores_total" ON "public"."trend_scores" USING "btree" ("total_score" DESC);


CREATE INDEX "job_locks_locked_until_idx" ON "public"."job_locks" USING "btree" ("locked_until" DESC);


CREATE INDEX "job_locks_updated_at_idx" ON "public"."job_locks" USING "btree" ("updated_at" DESC);


CREATE INDEX "job_runs_job_key_created_at_idx" ON "public"."job_runs" USING "btree" ("job_key", "created_at" DESC);


CREATE INDEX "job_runs_status_created_at_idx" ON "public"."job_runs" USING "btree" ("status", "created_at" DESC);


CREATE INDEX "legal_acceptances_type_created_at_idx" ON "public"."legal_acceptances" USING "btree" ("acceptance_type", "created_at" DESC);


CREATE INDEX "legal_acceptances_user_id_created_at_idx" ON "public"."legal_acceptances" USING "btree" ("user_id", "created_at" DESC);


CREATE UNIQUE INDEX "legal_acceptances_user_type_sha_uidx" ON "public"."legal_acceptances" USING "btree" ("user_id", "acceptance_type", "git_sha");


CREATE INDEX "loyalty_program_terms_acceptances_owner_type_owner_id_idx" ON "public"."loyalty_program_terms_acceptances" USING "btree" ("owner_type", "owner_id");


CREATE UNIQUE INDEX "payment_accounts_company_idx" ON "public"."payment_accounts" USING "btree" ("company_id") WHERE ("company_id" IS NOT NULL);


CREATE INDEX "payment_accounts_paypal_ready_company_idx" ON "public"."payment_accounts" USING "btree" ("company_id", "paypal_onboarding_done", "paypal_payments_receivable") WHERE (("company_id" IS NOT NULL) AND ("paypal_merchant_id" IS NOT NULL));


CREATE INDEX "payment_accounts_paypal_ready_user_idx" ON "public"."payment_accounts" USING "btree" ("user_id", "paypal_onboarding_done", "paypal_payments_receivable") WHERE (("user_id" IS NOT NULL) AND ("paypal_merchant_id" IS NOT NULL));


CREATE UNIQUE INDEX "payment_accounts_user_idx" ON "public"."payment_accounts" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);


CREATE INDEX "platform_logs_action_idx" ON "public"."platform_logs" USING "btree" ("action");


CREATE INDEX "platform_logs_timestamp_idx" ON "public"."platform_logs" USING "btree" ("timestamp" DESC);


CREATE INDEX "platform_logs_type_idx" ON "public"."platform_logs" USING "btree" ("type");


CREATE INDEX "platform_treatments_allowed_roles_gin" ON "public"."platform_treatments" USING "gin" ("allowed_roles");


CREATE INDEX "platform_treatments_category_idx" ON "public"."platform_treatments" USING "btree" ("category");


CREATE INDEX "platform_treatments_is_active_idx" ON "public"."platform_treatments" USING "btree" ("is_active");


CREATE UNIQUE INDEX "points_ledger_referral_first_purchase_reward_uidx" ON "public"."points_ledger" USING "btree" ("ref_id") WHERE (("reason" = 'referral_first_purchase_reward_v1'::"text") AND ("ref_type" = 'referral'::"text") AND ("ref_id" IS NOT NULL));


CREATE UNIQUE INDEX "points_ledger_referral_premium_reward_unique" ON "public"."points_ledger" USING "btree" ("ref_type", "ref_id", "reason") WHERE (("ref_type" = 'referral'::"text") AND ("reason" = 'referral_premium_conversion_reward_v1'::"text") AND ("ref_id" IS NOT NULL));


CREATE INDEX "referral_commissions_referred_idx" ON "public"."referral_commissions" USING "btree" ("referred_user_id");


CREATE INDEX "referral_commissions_referrer_idx" ON "public"."referral_commissions" USING "btree" ("referrer_user_id");


CREATE INDEX "referrals_pending_first_purchase_reward_idx" ON "public"."referrals" USING "btree" ("referred_id", "created_at") WHERE ("first_purchase_rewarded_at" IS NULL);


CREATE UNIQUE INDEX "referrals_referred_unique" ON "public"."referrals" USING "btree" ("referred_id");


CREATE INDEX "sensitive_verifications_expires_at_idx" ON "public"."sensitive_verifications" USING "btree" ("expires_at" DESC);


CREATE UNIQUE INDEX "sensitive_verifications_token_uidx" ON "public"."sensitive_verifications" USING "btree" ("token");


CREATE INDEX "sensitive_verifications_user_id_created_at_idx" ON "public"."sensitive_verifications" USING "btree" ("user_id", "created_at" DESC);


CREATE INDEX "sensitive_verifications_user_purpose_created_at_idx" ON "public"."sensitive_verifications" USING "btree" ("user_id", "purpose", "created_at" DESC);


CREATE UNIQUE INDEX "uniq_user_deletion_requests_active" ON "public"."user_deletion_requests" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['pending_email_confirm'::"text", 'confirmed'::"text"]));


CREATE UNIQUE INDEX "uq_company_service_catalog_assigned" ON "public"."company_service_catalog" USING "btree" ("company_id", "service_id", "professional_id") WHERE ("professional_id" IS NOT NULL);


CREATE UNIQUE INDEX "uq_company_service_catalog_unassigned" ON "public"."company_service_catalog" USING "btree" ("company_id", "service_id") WHERE ("professional_id" IS NULL);


CREATE UNIQUE INDEX "uq_csr_pending_idx" ON "public"."company_service_requests" USING "btree" ("company_id", "service_id", "professional_id") WHERE ("status" = 'pending'::"text");


CREATE UNIQUE INDEX "uq_finance_installment_plans_payment_session_id" ON "public"."finance_installment_plans" USING "btree" ("payment_session_id");


CREATE UNIQUE INDEX "uq_insurance_daily_report_log_date_recipient" ON "public"."insurance_daily_report_log" USING "btree" ("report_date", "recipient_email");


CREATE UNIQUE INDEX "uq_prof_catalog_custom" ON "public"."professional_catalog_items" USING "btree" ("professional_id", "custom_service_id") WHERE ("source_type" = 'custom'::"text");


CREATE UNIQUE INDEX "uq_prof_catalog_platform" ON "public"."professional_catalog_items" USING "btree" ("professional_id", "platform_treatment_id") WHERE ("source_type" = 'platform'::"text");


CREATE UNIQUE INDEX "uq_treatments_booking_id" ON "public"."treatments" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);


CREATE UNIQUE INDEX "users_codice_commerciale_unique_per_commerciale" ON "public"."users" USING "btree" ("codice_commerciale") WHERE (("codice_commerciale" IS NOT NULL) AND ("tipo_utente" = 'commerciale'::"public"."user_type"));


CREATE UNIQUE INDEX "users_codice_medico_unique_per_professional" ON "public"."users" USING "btree" ("codice_medico") WHERE (("codice_medico" IS NOT NULL) AND ("tipo_utente" = ANY (ARRAY['medico'::"public"."user_type", 'estetista'::"public"."user_type"])));


CREATE UNIQUE INDEX "ux_editorial_articles_publish_slug" ON "public"."editorial_articles" USING "btree" ("publish_slug") WHERE ("publish_slug" IS NOT NULL);


CREATE INDEX "idx_trash_coupons_company_deleted" ON "trash"."coupons" USING "btree" ("company_id", "deleted_at") WHERE ("company_id" IS NOT NULL);


CREATE INDEX "idx_trash_coupons_deleted_at" ON "trash"."coupons" USING "btree" ("deleted_at");


CREATE INDEX "idx_trash_coupons_medico_id" ON "trash"."coupons" USING "btree" ("medico_id");


CREATE INDEX "idx_trash_custom_services_medico_id" ON "trash"."custom_services" USING "btree" ("medico_id");


CREATE INDEX "idx_trash_treatments_booking_id" ON "trash"."treatments" USING "btree" ("booking_id");


CREATE INDEX "idx_trash_treatments_company_id" ON "trash"."treatments" USING "btree" ("company_id", "deleted_at") WHERE ("company_id" IS NOT NULL);


CREATE INDEX "idx_trash_treatments_medico_id" ON "trash"."treatments" USING "btree" ("medico_id");


CREATE INDEX "invites_deleted_at_idx" ON "trash"."invites" USING "btree" ("deleted_at" DESC);


CREATE INDEX "trash_users_deleted_at_idx" ON "trash"."users" USING "btree" ("deleted_at" DESC);


CREATE OR REPLACE TRIGGER "email_suppressions_touch" BEFORE UPDATE ON "public"."email_suppressions" FOR EACH ROW EXECUTE FUNCTION "public"."email_suppressions_touch_updated_at"();


CREATE OR REPLACE TRIGGER "enforce_paid_treatment_contract_guard" BEFORE DELETE OR UPDATE ON "public"."treatments" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_paid_treatment_contract_guard"();


CREATE OR REPLACE TRIGGER "forensic_anchor_batches_forbid_update_delete" BEFORE DELETE OR UPDATE ON "public"."forensic_anchor_batches" FOR EACH ROW EXECUTE FUNCTION "public"."forensic_forbid_update_delete"();


CREATE OR REPLACE TRIGGER "forensic_event_anchors_forbid_update_delete" BEFORE DELETE OR UPDATE ON "public"."forensic_event_anchors" FOR EACH ROW EXECUTE FUNCTION "public"."forensic_forbid_update_delete"();


CREATE OR REPLACE TRIGGER "forensic_events_forbid_update_delete" BEFORE DELETE OR UPDATE ON "public"."forensic_events" FOR EACH ROW EXECUTE FUNCTION "public"."forensic_forbid_update_delete"();


CREATE OR REPLACE TRIGGER "legal_acceptances_forbid_update_delete" BEFORE DELETE OR UPDATE ON "public"."legal_acceptances" FOR EACH ROW EXECUTE FUNCTION "public"."legal_acceptances_forbid_update_delete"();


CREATE OR REPLACE TRIGGER "set_platform_logs_updated_at" BEFORE UPDATE ON "public"."platform_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_platform_logs_updated_at"();


CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_updated_at"();


CREATE OR REPLACE TRIGGER "trg_apply_points_ledger_to_user" AFTER INSERT ON "public"."points_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."apply_points_ledger_to_user"();


CREATE OR REPLACE TRIGGER "trg_board_listings_updated_at" BEFORE UPDATE ON "public"."board_listings" FOR EACH ROW EXECUTE FUNCTION "public"."touch_board_listing_updated_at"();


CREATE OR REPLACE TRIGGER "trg_company_commerciale_links_expires_at" BEFORE INSERT OR UPDATE ON "public"."company_commerciale_links" FOR EACH ROW EXECUTE FUNCTION "public"."trg_fn_company_commerciale_expires_at"();


CREATE OR REPLACE TRIGGER "trg_company_rooms_updated_at" BEFORE UPDATE ON "public"."company_rooms" FOR EACH ROW EXECUTE FUNCTION "public"."company_rooms_set_updated_at"();


CREATE OR REPLACE TRIGGER "trg_enforce_company_member_user_type" BEFORE INSERT OR UPDATE OF "user_id" ON "public"."company_members" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_company_member_user_type"();


CREATE OR REPLACE TRIGGER "trg_platform_logs_set_updated_at" BEFORE UPDATE ON "public"."platform_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();


CREATE OR REPLACE TRIGGER "trg_user_deletion_requests_updated_at" BEFORE UPDATE ON "public"."user_deletion_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_user_deletion_request"();


CREATE OR REPLACE TRIGGER "trigger_update_email_audit_log_updated_at" BEFORE UPDATE ON "public"."email_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_audit_log_updated_at"();


CREATE OR REPLACE TRIGGER "trigger_update_email_domain_blacklist_updated_at" BEFORE UPDATE ON "public"."email_domain_blacklist" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_audit_log_updated_at"();


CREATE OR REPLACE TRIGGER "update_booking_availability_updated_at" BEFORE UPDATE ON "public"."booking_availability" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_consent_templates_updated_at" BEFORE UPDATE ON "public"."consent_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_credibility_checks_updated_at" BEFORE UPDATE ON "public"."credibility_checks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_custom_services_updated_at" BEFORE UPDATE ON "public"."custom_services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_finance_installment_plans_updated_at" BEFORE UPDATE ON "public"."finance_installment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_finance_invoice_jobs_updated_at" BEFORE UPDATE ON "public"."finance_invoice_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_finance_payment_sessions_updated_at" BEFORE UPDATE ON "public"."finance_payment_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_finance_payout_batches_updated_at" BEFORE UPDATE ON "public"."finance_payout_batches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_finance_payout_items_updated_at" BEFORE UPDATE ON "public"."finance_payout_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_finance_receipts_updated_at" BEFORE UPDATE ON "public"."finance_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_finance_transactions_updated_at" BEFORE UPDATE ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_gallery_items_updated_at" BEFORE UPDATE ON "public"."gallery_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_professional_catalog_items_updated_at" BEFORE UPDATE ON "public"."professional_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_professional_verifications_updated_at" BEFORE UPDATE ON "public"."professional_verifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_treatments_updated_at" BEFORE UPDATE ON "public"."treatments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


ALTER TABLE ONLY "public"."binding_requests"
    ADD CONSTRAINT "binding_requests_commerciale_id_fkey" FOREIGN KEY ("commerciale_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."binding_requests"
    ADD CONSTRAINT "binding_requests_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."binding_requests"
    ADD CONSTRAINT "binding_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."board_listing_quotas"
    ADD CONSTRAINT "board_listing_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."board_listing_reports"
    ADD CONSTRAINT "board_listing_reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."board_listings"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."board_listing_reports"
    ADD CONSTRAINT "board_listing_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."board_listing_reports"
    ADD CONSTRAINT "board_listing_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."board_listings"
    ADD CONSTRAINT "board_listings_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."board_listings"
    ADD CONSTRAINT "board_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."booking_availability"
    ADD CONSTRAINT "booking_availability_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."booking_availability"
    ADD CONSTRAINT "booking_availability_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."booking_blocked_slots"
    ADD CONSTRAINT "booking_blocked_slots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."booking_blocked_slots"
    ADD CONSTRAINT "booking_blocked_slots_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."booking_notification_deliveries"
    ADD CONSTRAINT "booking_notification_deliveries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."booking_notification_deliveries"
    ADD CONSTRAINT "booking_notification_deliveries_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."booking_settings"
    ADD CONSTRAINT "booking_settings_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."company_rooms"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."custom_services"("id");


ALTER TABLE ONLY "public"."commerciale_rewards"
    ADD CONSTRAINT "commerciale_rewards_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."commerciale_rewards"
    ADD CONSTRAINT "commerciale_rewards_commerciale_id_fkey" FOREIGN KEY ("commerciale_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."commerciale_settings"
    ADD CONSTRAINT "commerciale_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."company_clients"
    ADD CONSTRAINT "company_clients_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."company_clients"
    ADD CONSTRAINT "company_clients_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_clients"
    ADD CONSTRAINT "company_clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_clients"
    ADD CONSTRAINT "company_clients_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."company_commerciale_links"
    ADD CONSTRAINT "company_commerciale_links_commerciale_id_fkey" FOREIGN KEY ("commerciale_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_commerciale_links"
    ADD CONSTRAINT "company_commerciale_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_contacts"
    ADD CONSTRAINT "company_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_contacts"
    ADD CONSTRAINT "company_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_contacts"
    ADD CONSTRAINT "company_contacts_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."company_member_invites"
    ADD CONSTRAINT "company_member_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."company_member_invites"
    ADD CONSTRAINT "company_member_invites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_member_invites"
    ADD CONSTRAINT "company_member_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."company_member_invites"
    ADD CONSTRAINT "company_member_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_rooms"
    ADD CONSTRAINT "company_rooms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_service_catalog"
    ADD CONSTRAINT "company_service_catalog_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_service_catalog"
    ADD CONSTRAINT "company_service_catalog_consent_template_id_fkey" FOREIGN KEY ("consent_template_id") REFERENCES "public"."consent_templates"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."company_service_catalog"
    ADD CONSTRAINT "company_service_catalog_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_service_catalog"
    ADD CONSTRAINT "company_service_catalog_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."custom_services"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_service_requests"
    ADD CONSTRAINT "company_service_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_service_requests"
    ADD CONSTRAINT "company_service_requests_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."company_service_requests"
    ADD CONSTRAINT "company_service_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."company_service_requests"
    ADD CONSTRAINT "company_service_requests_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."company_service_requests"
    ADD CONSTRAINT "company_service_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."custom_services"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_audit_logs"
    ADD CONSTRAINT "consent_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_audit_logs"
    ADD CONSTRAINT "consent_audit_logs_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."consent_documents"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_audit_logs"
    ADD CONSTRAINT "consent_audit_logs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."consent_document_versions"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_document_versions"
    ADD CONSTRAINT "consent_document_versions_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."consent_documents"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_document_versions"
    ADD CONSTRAINT "consent_document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_documents"
    ADD CONSTRAINT "consent_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_documents"
    ADD CONSTRAINT "consent_documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "public"."consent_document_versions"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_documents"
    ADD CONSTRAINT "consent_documents_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_documents"
    ADD CONSTRAINT "consent_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."consent_templates"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_documents"
    ADD CONSTRAINT "consent_documents_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_share_tokens"
    ADD CONSTRAINT "consent_share_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_share_tokens"
    ADD CONSTRAINT "consent_share_tokens_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_share_tokens"
    ADD CONSTRAINT "consent_share_tokens_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_signatures"
    ADD CONSTRAINT "consent_signatures_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."consent_documents"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."consent_signatures"
    ADD CONSTRAINT "consent_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_signatures"
    ADD CONSTRAINT "consent_signatures_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."consent_document_versions"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_templates"
    ADD CONSTRAINT "consent_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."consent_templates"
    ADD CONSTRAINT "consent_templates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credibility_audit_events"
    ADD CONSTRAINT "credibility_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."credibility_audit_events"
    ADD CONSTRAINT "credibility_audit_events_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."credibility_checks"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."credibility_audit_events"
    ADD CONSTRAINT "credibility_audit_events_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credibility_checks"
    ADD CONSTRAINT "credibility_checks_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credibility_mentions"
    ADD CONSTRAINT "credibility_mentions_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."credibility_checks"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credibility_mentions"
    ADD CONSTRAINT "credibility_mentions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credibility_reviews"
    ADD CONSTRAINT "credibility_reviews_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."credibility_checks"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credibility_reviews"
    ADD CONSTRAINT "credibility_reviews_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credibility_scores"
    ADD CONSTRAINT "credibility_scores_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."credibility_checks"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credibility_scores"
    ADD CONSTRAINT "credibility_scores_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."custom_services"
    ADD CONSTRAINT "custom_services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."custom_services"
    ADD CONSTRAINT "custom_services_contributed_by_fkey" FOREIGN KEY ("contributed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."custom_services"
    ADD CONSTRAINT "custom_services_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."custom_services"
    ADD CONSTRAINT "custom_services_source_service_id_fkey" FOREIGN KEY ("source_service_id") REFERENCES "public"."custom_services"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."editorial_articles"
    ADD CONSTRAINT "editorial_articles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."editorial_articles"
    ADD CONSTRAINT "editorial_articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."editorial_articles"
    ADD CONSTRAINT "editorial_articles_trend_cluster_id_fkey" FOREIGN KEY ("trend_cluster_id") REFERENCES "public"."trend_clusters"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."editorial_audit_events"
    ADD CONSTRAINT "editorial_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."editorial_homepage_slots"
    ADD CONSTRAINT "editorial_homepage_slots_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."editorial_articles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."editorial_homepage_slots"
    ADD CONSTRAINT "editorial_homepage_slots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."editorial_publications"
    ADD CONSTRAINT "editorial_publications_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."editorial_articles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."editorial_publications"
    ADD CONSTRAINT "editorial_publications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."editorial_user_events"
    ADD CONSTRAINT "editorial_user_events_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."editorial_articles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."editorial_user_events"
    ADD CONSTRAINT "editorial_user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."editorial_user_preferences"
    ADD CONSTRAINT "editorial_user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."email_audit_log"
    ADD CONSTRAINT "email_audit_log_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."email_events"
    ADD CONSTRAINT "email_events_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "public"."email_audit_log"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."email_forwards"
    ADD CONSTRAINT "email_forwards_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "public"."email_audit_log"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."email_forwards"
    ADD CONSTRAINT "email_forwards_forwarded_by_user_id_fkey" FOREIGN KEY ("forwarded_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."email_suppressions"
    ADD CONSTRAINT "email_suppressions_unsuppressed_by_fkey" FOREIGN KEY ("unsuppressed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."event_logs"
    ADD CONSTRAINT "event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_bonus_reimbursement_batches"
    ADD CONSTRAINT "finance_bonus_reimbursement_batches_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."finance_installment_plans"
    ADD CONSTRAINT "finance_installment_plans_payment_session_id_fkey" FOREIGN KEY ("payment_session_id") REFERENCES "public"."finance_payment_sessions"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_installment_plans"
    ADD CONSTRAINT "finance_installment_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_invoice_jobs"
    ADD CONSTRAINT "finance_invoice_jobs_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."finance_receipts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_ledger_entries"
    ADD CONSTRAINT "finance_ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."finance_transactions"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_ledger_entries"
    ADD CONSTRAINT "finance_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."finance_payment_sessions"
    ADD CONSTRAINT "finance_payment_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_payout_batches"
    ADD CONSTRAINT "finance_payout_batches_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."finance_payout_items"
    ADD CONSTRAINT "finance_payout_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."finance_payout_batches"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."finance_payout_items"
    ADD CONSTRAINT "finance_payout_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_receipts"
    ADD CONSTRAINT "finance_receipts_issuer_user_id_fkey" FOREIGN KEY ("issuer_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."finance_receipts"
    ADD CONSTRAINT "finance_receipts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."finance_transactions"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_receipts"
    ADD CONSTRAINT "finance_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_payment_session_id_fkey" FOREIGN KEY ("payment_session_id") REFERENCES "public"."finance_payment_sessions"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."forensic_audit_log"
    ADD CONSTRAINT "forensic_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."forensic_audit_log"
    ADD CONSTRAINT "forensic_audit_log_integrity_record_id_fkey" FOREIGN KEY ("integrity_record_id") REFERENCES "public"."forensic_integrity_records"("id");


ALTER TABLE ONLY "public"."forensic_event_anchors"
    ADD CONSTRAINT "forensic_event_anchors_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."forensic_anchor_batches"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."forensic_event_anchors"
    ADD CONSTRAINT "forensic_event_anchors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."forensic_events"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."forum_flags"
    ADD CONSTRAINT "forum_flags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."forum_flags"
    ADD CONSTRAINT "forum_flags_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "public"."forum_posts"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."forum_threads"
    ADD CONSTRAINT "forum_threads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."forum_categories"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."gallery_items"
    ADD CONSTRAINT "gallery_items_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."gallery_items"
    ADD CONSTRAINT "gallery_items_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."gallery_items"
    ADD CONSTRAINT "gallery_items_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."gallery_likes"
    ADD CONSTRAINT "gallery_likes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."gallery_items"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."gallery_likes"
    ADD CONSTRAINT "gallery_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."insurance_manual_registrations"
    ADD CONSTRAINT "insurance_manual_registrations_finance_session_id_fkey" FOREIGN KEY ("finance_session_id") REFERENCES "public"."finance_payment_sessions"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."insurance_manual_registrations"
    ADD CONSTRAINT "insurance_manual_registrations_premium_payment_id_fkey" FOREIGN KEY ("premium_payment_id") REFERENCES "public"."premium_payments"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."insurance_manual_registrations"
    ADD CONSTRAINT "insurance_manual_registrations_registered_by_admin_id_fkey" FOREIGN KEY ("registered_by_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."insurance_manual_registrations"
    ADD CONSTRAINT "insurance_manual_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_commerciale_id_fkey" FOREIGN KEY ("commerciale_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."legal_consent_audit_logs"
    ADD CONSTRAINT "legal_consent_audit_logs_consent_template_id_fkey" FOREIGN KEY ("consent_template_id") REFERENCES "public"."consent_templates"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."legal_consent_audit_logs"
    ADD CONSTRAINT "legal_consent_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."loyalty_credits_ledger"
    ADD CONSTRAINT "loyalty_credits_ledger_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."loyalty_credits_ledger"
    ADD CONSTRAINT "loyalty_credits_ledger_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."loyalty_subscriptions"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."loyalty_program_terms_acceptances"
    ADD CONSTRAINT "loyalty_program_terms_acceptances_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."loyalty_subscriptions"
    ADD CONSTRAINT "loyalty_subscriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."message_messages"
    ADD CONSTRAINT "message_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."message_messages"
    ADD CONSTRAINT "message_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."otps"
    ADD CONSTRAINT "otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."patient_professional_links"
    ADD CONSTRAINT "patient_professional_links_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."patient_professional_links"
    ADD CONSTRAINT "patient_professional_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."patient_professional_links"
    ADD CONSTRAINT "patient_professional_links_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "points_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."premium_payments"
    ADD CONSTRAINT "premium_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."premium_subscriptions"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."premium_payments"
    ADD CONSTRAINT "premium_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."premium_renewal_reminders"
    ADD CONSTRAINT "premium_renewal_reminders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."premium_subscriptions"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."premium_renewal_reminders"
    ADD CONSTRAINT "premium_renewal_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."premium_subscriptions"
    ADD CONSTRAINT "premium_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."professional_catalog_items"
    ADD CONSTRAINT "professional_catalog_items_consent_template_id_fkey" FOREIGN KEY ("consent_template_id") REFERENCES "public"."consent_templates"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."professional_catalog_items"
    ADD CONSTRAINT "professional_catalog_items_custom_service_id_fkey" FOREIGN KEY ("custom_service_id") REFERENCES "public"."custom_services"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."professional_catalog_items"
    ADD CONSTRAINT "professional_catalog_items_disclaimer_accepted_by_fkey" FOREIGN KEY ("disclaimer_accepted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."professional_catalog_items"
    ADD CONSTRAINT "professional_catalog_items_platform_treatment_id_fkey" FOREIGN KEY ("platform_treatment_id") REFERENCES "public"."platform_treatments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."professional_catalog_items"
    ADD CONSTRAINT "professional_catalog_items_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."professional_contract_renewal_reminders"
    ADD CONSTRAINT "professional_contract_renewal_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."professional_disclaimer_acceptances"
    ADD CONSTRAINT "professional_disclaimer_acceptances_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."professional_offered_treatments"
    ADD CONSTRAINT "professional_offered_treatments_platform_treatment_id_fkey" FOREIGN KEY ("platform_treatment_id") REFERENCES "public"."platform_treatments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."professional_offered_treatments"
    ADD CONSTRAINT "professional_offered_treatments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."professional_verifications"
    ADD CONSTRAINT "professional_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."referral_commissions"
    ADD CONSTRAINT "referral_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."referral_commissions"
    ADD CONSTRAINT "referral_commissions_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."referral_commissions"
    ADD CONSTRAINT "referral_commissions_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."company_rooms"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."trend_cluster_items"
    ADD CONSTRAINT "trend_cluster_items_normalized_content_item_id_fkey" FOREIGN KEY ("normalized_content_item_id") REFERENCES "public"."normalized_content_items"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."trend_cluster_items"
    ADD CONSTRAINT "trend_cluster_items_trend_cluster_id_fkey" FOREIGN KEY ("trend_cluster_id") REFERENCES "public"."trend_clusters"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."trend_scores"
    ADD CONSTRAINT "trend_scores_trend_cluster_id_fkey" FOREIGN KEY ("trend_cluster_id") REFERENCES "public"."trend_clusters"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_auth_links"
    ADD CONSTRAINT "user_auth_links_app_user_id_fkey" FOREIGN KEY ("app_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_auth_links"
    ADD CONSTRAINT "user_auth_links_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_deletion_requests"
    ADD CONSTRAINT "user_deletion_requests_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."user_deletion_requests"
    ADD CONSTRAINT "user_deletion_requests_pec_confirmation_by_fkey" FOREIGN KEY ("pec_confirmation_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."user_deletion_requests"
    ADD CONSTRAINT "user_deletion_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."user_deletion_requests"
    ADD CONSTRAINT "user_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_loyalty_program_configs"
    ADD CONSTRAINT "user_loyalty_program_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_medico_riferimento_id_fkey" FOREIGN KEY ("medico_riferimento_id") REFERENCES "public"."users"("id");


ALTER TABLE ONLY "public"."verification_documents"
    ADD CONSTRAINT "verification_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "public"."professional_verifications"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "trash"."treatments"
    ADD CONSTRAINT "trash_treatments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "trash"."treatments"
    ADD CONSTRAINT "trash_treatments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "trash"."users"
    ADD CONSTRAINT "users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


ALTER TABLE "public"."backfill_review" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."binding_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_listing_quotas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_listing_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_blocked_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_notification_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commerciale_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commerciale_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_commerciale_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_member_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_service_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_service_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_document_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_share_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_signatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts_trash" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credibility_audit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credibility_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credibility_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credibility_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credibility_mentions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credibility_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credibility_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_audit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_homepage_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_job_heartbeats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_publications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_user_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_domain_blacklist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_forwards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_suppressions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_bonus_reimbursement_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_installment_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_invoice_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_ledger_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_payment_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_payout_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_payout_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_provider_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensic_anchor_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensic_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensic_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensic_chain_heads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensic_document_integrity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensic_event_anchors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensic_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensic_integrity_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forensics_issue_resolutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gallery_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gallery_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insurance_daily_report_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insurance_manual_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_locks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kv_store_6af57f5a" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_acceptances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_consent_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_credits_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_program_terms_acceptances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."normalized_content_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_professional_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_treatments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_renewal_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_catalog_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_contract_renewal_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_disclaimer_acceptances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_offered_treatments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sensitive_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trend_cluster_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trend_clusters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trend_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_auth_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_deletion_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_loyalty_program_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "trash" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";


