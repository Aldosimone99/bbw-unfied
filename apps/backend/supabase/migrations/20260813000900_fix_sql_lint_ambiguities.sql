-- Qualify or rename PL/pgSQL variables that conflict with table columns.
-- This keeps the catalog import and patient invitation revoke functions lint-clean.

create or replace function public.import_catalog_master(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  item jsonb;
  category_id uuid;
  category_code text;
  category_display_name text;
  incoming_external_code text;
  incoming_codes text[] := array[]::text[];
  incoming_category_codes text[] := array[]::text[];
begin
  if (select auth.role()) <> 'service_role' then raise exception 'CATALOG_SERVICE_ROLE_REQUIRED'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'CATALOG_IMPORT_EMPTY'; end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    category_code := nullif(btrim(item ->> 'categoryCode'), '');
    category_display_name := nullif(btrim(item ->> 'categoryDisplayName'), '');
    incoming_external_code := nullif(btrim(item ->> 'externalCode'), '');
    if category_code is null or category_display_name is null or incoming_external_code is null then raise exception 'CATALOG_IMPORT_INVALID_ROW'; end if;
    if not (category_code = any(incoming_category_codes)) then
      incoming_category_codes := array_append(incoming_category_codes, category_code);
      insert into public.treatment_categories (code, display_name, sort_order, is_active)
      values (category_code, category_display_name, (item ->> 'categorySortOrder')::integer, true)
      on conflict (code) do update set display_name = excluded.display_name, sort_order = excluded.sort_order,
        is_active = true, updated_at = timezone('utc', now())
      returning id into category_id;
    else
      select id into category_id from public.treatment_categories where code = category_code;
    end if;

    incoming_codes := array_append(incoming_codes, incoming_external_code);
    insert into public.catalog_treatments (
      external_code, name, category_id, description, body_area, default_points, default_price_cents,
      default_duration_min_minutes, default_duration_max_minutes, duration_label, professional_requirements, is_active
    )
    values (
      incoming_external_code, btrim(item ->> 'name'), category_id, item ->> 'description', btrim(item ->> 'bodyArea'),
      (item ->> 'points')::integer, (item ->> 'priceCents')::integer, (item ->> 'durationMinMinutes')::integer,
      (item ->> 'durationMaxMinutes')::integer, btrim(item ->> 'durationLabel'),
      array(select jsonb_array_elements_text(item -> 'professionalRequirements')), true
    )
    on conflict (external_code) do update set
      name = excluded.name, category_id = excluded.category_id, description = excluded.description,
      body_area = excluded.body_area, default_points = excluded.default_points, default_price_cents = excluded.default_price_cents,
      default_duration_min_minutes = excluded.default_duration_min_minutes,
      default_duration_max_minutes = excluded.default_duration_max_minutes, duration_label = excluded.duration_label,
      professional_requirements = excluded.professional_requirements, is_active = true,
      updated_at = timezone('utc', now());
  end loop;

  update public.catalog_treatments
  set is_active = false, updated_at = timezone('utc', now())
  where is_active and not (external_code = any(incoming_codes));
  update public.treatment_categories
  set is_active = false, updated_at = timezone('utc', now())
  where is_active and not (code = any(incoming_category_codes));

  return jsonb_build_object('categories', cardinality(incoming_category_codes), 'treatments', cardinality(incoming_codes));
end;
$$;

create or replace function public.revoke_patient_relationship_invitation(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  invitation_status text;
  invitation_type text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  select invitation.status, invitation.invitation_type
  into invitation_status, invitation_type
  from public.invitations invitation
  where invitation.id = p_invitation_id
    and invitation.organization_id = p_organization_id
  for update;

  if not found or invitation_type <> 'patient_relationship' then
    raise exception 'PATIENT_INVITATION_NOT_FOUND';
  end if;
  if invitation_status = 'revoked' then
    raise exception 'PATIENT_INVITATION_REVOKED';
  end if;
  if invitation_status = 'accepted' then
    raise exception 'PATIENT_INVITATION_ALREADY_ACCEPTED';
  end if;
  if invitation_status <> 'pending' then
    raise exception 'PATIENT_INVITATION_NOT_FOUND';
  end if;

  update public.invitations
  set status = 'revoked', revoked_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = p_invitation_id;

  insert into public.audit_events (
    actor_user_id, organization_id, action, resource_type, resource_id, metadata
  )
  values (
    p_actor_user_id, p_organization_id, 'patient.invitation.revoked', 'invitation', p_invitation_id,
    jsonb_build_object('invitation_type', 'patient_relationship')
  );

  return p_invitation_id;
end;
$$;
