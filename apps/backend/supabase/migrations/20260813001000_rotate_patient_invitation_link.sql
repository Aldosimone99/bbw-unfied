-- Rotate a patient invitation token without exposing or persisting the raw token.
-- The caller must already be authorized by the backend service layer.

create or replace function public.rotate_patient_relationship_invitation_link(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_actor_user_id uuid,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  invitation_status text;
  invitation_type_value text;
  invitation_expires_at timestamptz;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_INVITATION_SERVICE_ROLE_REQUIRED';
  end if;
  if btrim(coalesce(p_token_hash, '')) = '' then
    raise exception 'PATIENT_INVITATION_INVALID_INPUT';
  end if;

  select invitation.status, invitation.invitation_type, invitation.expires_at
  into invitation_status, invitation_type_value, invitation_expires_at
  from public.invitations invitation
  where invitation.id = p_invitation_id
    and invitation.organization_id = p_organization_id
  for update;

  if not found or invitation_type_value <> 'patient_relationship' then
    raise exception 'PATIENT_INVITATION_NOT_FOUND';
  end if;
  if invitation_status = 'revoked' then
    raise exception 'PATIENT_INVITATION_REVOKED';
  end if;
  if invitation_status = 'accepted' then
    raise exception 'PATIENT_INVITATION_ALREADY_ACCEPTED';
  end if;
  if invitation_status = 'expired' or invitation_expires_at <= timezone('utc', now()) then
    update public.invitations
    set status = 'expired', updated_at = timezone('utc', now())
    where id = p_invitation_id;
    raise exception 'PATIENT_INVITATION_EXPIRED';
  end if;
  if invitation_status <> 'pending' then
    raise exception 'PATIENT_INVITATION_NOT_FOUND';
  end if;

  update public.invitations
  set token_hash = p_token_hash, updated_at = timezone('utc', now())
  where id = p_invitation_id;

  insert into public.audit_events (
    actor_user_id, organization_id, action, resource_type, resource_id, metadata
  )
  values (
    p_actor_user_id, p_organization_id, 'patient.invitation.link_rotated', 'invitation', p_invitation_id,
    jsonb_build_object('invitation_type', 'patient_relationship')
  );

  return p_invitation_id;
end;
$$;

revoke all on function public.rotate_patient_relationship_invitation_link(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rotate_patient_relationship_invitation_link(uuid, uuid, uuid, text) to service_role;
