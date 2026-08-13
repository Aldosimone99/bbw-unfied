-- Keep organization invitation history operations isolated from patient invitations.

create or replace function public.hide_organization_invitation_from_history(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  invitation_status text;
  invitation_expires_at timestamptz;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  select status, expires_at into invitation_status, invitation_expires_at
  from public.invitations
  where id = p_invitation_id
    and organization_id = p_organization_id
    and invitation_type = 'organization_member'
  for update;

  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;
  if invitation_status = 'pending' and invitation_expires_at <= timezone('utc', now()) then
    update public.invitations
    set status = 'expired'
    where id = p_invitation_id
      and invitation_type = 'organization_member';
    invitation_status := 'expired';
  end if;
  if invitation_status = 'pending' then
    raise exception 'INVITATION_PENDING_HISTORY_HIDE_NOT_ALLOWED';
  end if;

  update public.invitations
  set hidden_from_history_at = timezone('utc', now()), hidden_from_history_by = p_actor_user_id
  where id = p_invitation_id
    and invitation_type = 'organization_member';

  insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
  values (p_actor_user_id, p_organization_id, 'organization.invitation.history_hidden', 'invitation', p_invitation_id, '{}'::jsonb);
end;
$$;

create or replace function public.clear_organization_invitation_history(
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  hidden_count integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  update public.invitations
  set status = 'expired'
  where organization_id = p_organization_id
    and invitation_type = 'organization_member'
    and status = 'pending'
    and expires_at <= timezone('utc', now());

  with hidden as (
    update public.invitations
    set hidden_from_history_at = timezone('utc', now()), hidden_from_history_by = p_actor_user_id
    where organization_id = p_organization_id
      and invitation_type = 'organization_member'
      and hidden_from_history_at is null
      and status in ('accepted', 'revoked', 'expired')
    returning id
  )
  select count(*) into hidden_count from hidden;

  if hidden_count > 0 then
    insert into public.audit_events (actor_user_id, organization_id, action, resource_type, resource_id, metadata)
    values (
      p_actor_user_id,
      p_organization_id,
      'organization.invitation.history_cleared',
      'invitation_history',
      null,
      jsonb_build_object('hidden_count', hidden_count)
    );
  end if;

  return hidden_count;
end;
$$;
