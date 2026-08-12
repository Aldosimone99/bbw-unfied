-- Accept an organization invitation atomically.
-- Only the trusted backend service role may execute this function.

create or replace function public.accept_organization_invitation(
  p_token_hash text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  invitation_record public.invitations%rowtype;
  invited_user_email text;
  membership_id uuid;
  assigned_role_code text;
  was_already_accepted boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  if p_user_id is null or btrim(coalesce(p_token_hash, '')) = '' then
    raise exception 'INVITATION_INVALID_INPUT';
  end if;

  select *
  into invitation_record
  from public.invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  if invitation_record.status = 'accepted' then
    if invitation_record.accepted_by is distinct from p_user_id then
      raise exception 'INVITATION_ALREADY_ACCEPTED';
    end if;
    was_already_accepted := true;
  elsif invitation_record.status <> 'pending' then
    raise exception 'INVITATION_NOT_PENDING';
  elsif invitation_record.expires_at <= timezone('utc', now()) then
    update public.invitations
    set status = 'expired'
    where id = invitation_record.id;
    raise exception 'INVITATION_EXPIRED';
  end if;

  select lower(email)
  into invited_user_email
  from auth.users
  where id = p_user_id;

  if invited_user_email is null then
    raise exception 'INVITATION_USER_NOT_FOUND';
  end if;

  if invited_user_email <> lower(invitation_record.email) then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  select code
  into assigned_role_code
  from public.roles
  where id = invitation_record.role_id
    and scope = 'organization'
    and is_active;

  if assigned_role_code is null then
    raise exception 'INVITATION_ROLE_NOT_CONFIGURED';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    status,
    joined_at
  )
  values (
    invitation_record.organization_id,
    p_user_id,
    'active',
    timezone('utc', now())
  )
  on conflict (organization_id, user_id)
  do update set
    status = 'active',
    joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at)
  returning id into membership_id;

  insert into public.member_roles (organization_member_id, role_id)
  values (membership_id, invitation_record.role_id)
  on conflict (organization_member_id, role_id) do nothing;

  if not was_already_accepted then
    update public.invitations
    set
      status = 'accepted',
      accepted_by = p_user_id,
      accepted_at = timezone('utc', now())
    where id = invitation_record.id;

    insert into public.audit_events (
      actor_user_id,
      organization_id,
      action,
      resource_type,
      resource_id,
      metadata
    )
    values (
      p_user_id,
      invitation_record.organization_id,
      'organization.invitation.accepted',
      'invitation',
      invitation_record.id,
      jsonb_build_object('role', assigned_role_code)
    );
  end if;

  return jsonb_build_object(
    'organization_id', invitation_record.organization_id,
    'role_code', assigned_role_code,
    'already_member', was_already_accepted
  );
end;
$$;

revoke all on function public.accept_organization_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_organization_invitation(text, uuid) to service_role;
