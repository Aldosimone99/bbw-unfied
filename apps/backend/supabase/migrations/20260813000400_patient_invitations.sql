-- Generalize canonical invitations without mixing organization members and patients.
-- Patient invitations create only organization_patient_relationships on acceptance.

alter table public.invitations
  add column invitation_type text not null default 'organization_member';

alter table public.invitations
  alter column role_id drop not null;

alter table public.invitations
  add constraint invitations_invitation_type_check
    check (invitation_type in ('organization_member', 'patient_relationship')),
  add constraint invitations_invitation_role_check
    check (
      (invitation_type = 'organization_member' and role_id is not null)
      or (invitation_type = 'patient_relationship' and role_id is null)
    );

drop index if exists public.invitations_pending_email_unique;
create unique index invitations_pending_member_email_unique
  on public.invitations (organization_id, lower(email))
  where status = 'pending' and invitation_type = 'organization_member';
create unique index invitations_pending_patient_email_unique
  on public.invitations (organization_id, lower(email))
  where status = 'pending' and invitation_type = 'patient_relationship';

create index invitations_type_status_idx
  on public.invitations (organization_id, invitation_type, status, created_at desc);

-- Existing medical acceptance validation must never run for patient invitations.
create or replace function public.enforce_medical_organization_invitation_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  invitation_role_code text;
begin
  if new.invitation_type <> 'organization_member' then
    return new;
  end if;
  if new.status <> 'accepted' or old.status = 'accepted' then
    return new;
  end if;

  select code into invitation_role_code
  from public.roles
  where id = new.role_id and scope = 'organization' and is_active;

  if invitation_role_code is distinct from 'practitioner' then
    raise exception 'INVITATION_ROLE_NOT_MEDICAL';
  end if;

  if new.accepted_by is null or not exists (
    select 1
    from public.professional_profiles professional_profile
    join public.professional_types professional_type
      on professional_type.id = professional_profile.professional_type_id
    where professional_profile.user_id = new.accepted_by
      and professional_type.code = 'physician'
      and professional_type.is_active
      and professional_profile.verification_status = 'verified'
  ) then
    raise exception 'INVITATION_RECIPIENT_NOT_PHYSICIAN';
  end if;

  return new;
end;
$$;

create or replace function public.create_patient_relationship_invitation(
  p_organization_id uuid,
  p_email text,
  p_invited_by uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  invitation_id uuid;
  normalized_email text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_INVITATION_SERVICE_ROLE_REQUIRED';
  end if;

  normalized_email := lower(btrim(coalesce(p_email, '')));
  if p_organization_id is null or p_invited_by is null
    or normalized_email = '' or position('@' in normalized_email) <= 1
    or btrim(coalesce(p_token_hash, '')) = ''
    or p_expires_at is null or p_expires_at <= timezone('utc', now()) then
    raise exception 'PATIENT_INVITATION_INVALID_INPUT';
  end if;

  if not exists (
    select 1 from public.organizations
    where id = p_organization_id and status = 'active'
  ) then
    raise exception 'PATIENT_INVITATION_ORGANIZATION_NOT_ACTIVE';
  end if;

  if exists (
    select 1
    from public.organization_patient_relationships relationship
    join public.subjects subject on subject.id = relationship.subject_id
    join auth.users account on account.id = subject.user_id
    where relationship.organization_id = p_organization_id
      and relationship.status = 'active'
      and lower(btrim(account.email)) = normalized_email
  ) then
    raise exception 'PATIENT_RELATIONSHIP_ALREADY_ACTIVE';
  end if;

  update public.invitations
  set status = 'expired', updated_at = timezone('utc', now())
  where organization_id = p_organization_id
    and invitation_type = 'patient_relationship'
    and status = 'pending'
    and lower(email) = normalized_email
    and expires_at <= timezone('utc', now());

  if exists (
    select 1 from public.invitations
    where organization_id = p_organization_id
      and invitation_type = 'patient_relationship'
      and status = 'pending'
      and lower(email) = normalized_email
  ) then
    raise exception 'PATIENT_INVITATION_ALREADY_PENDING';
  end if;

  insert into public.invitations (
    organization_id, email, invitation_type, role_id, invited_by,
    token_hash, status, expires_at
  )
  values (
    p_organization_id, normalized_email, 'patient_relationship', null, p_invited_by,
    p_token_hash, 'pending', p_expires_at
  )
  returning id into invitation_id;

  insert into public.audit_events (
    actor_user_id, organization_id, action, resource_type, resource_id, metadata
  )
  values (
    p_invited_by, p_organization_id, 'patient.invitation.created', 'invitation', invitation_id,
    jsonb_build_object('invitation_type', 'patient_relationship')
  );

  return invitation_id;
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

  select status, invitation_type
  into invitation_status, invitation_type
  from public.invitations
  where id = p_invitation_id and organization_id = p_organization_id
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

create or replace function public.accept_patient_relationship_invitation(
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
  resolved_subject_id uuid;
  relationship_id uuid;
  relationship_status text;
  relationship_reactivated boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'PATIENT_INVITATION_SERVICE_ROLE_REQUIRED';
  end if;
  if p_user_id is null or btrim(coalesce(p_token_hash, '')) = '' then
    raise exception 'PATIENT_INVITATION_INVALID_INPUT';
  end if;

  select * into invitation_record
  from public.invitations
  where token_hash = p_token_hash
  for update;

  if not found or invitation_record.invitation_type <> 'patient_relationship' then
    raise exception 'PATIENT_INVITATION_NOT_FOUND';
  end if;
  if invitation_record.status = 'accepted' then
    raise exception 'PATIENT_INVITATION_ALREADY_ACCEPTED';
  end if;
  if invitation_record.status = 'revoked' then
    raise exception 'PATIENT_INVITATION_REVOKED';
  end if;
  if invitation_record.status = 'expired' or invitation_record.expires_at <= timezone('utc', now()) then
    update public.invitations
    set status = 'expired', updated_at = timezone('utc', now())
    where id = invitation_record.id;
    raise exception 'PATIENT_INVITATION_EXPIRED';
  end if;
  if invitation_record.status <> 'pending' then
    raise exception 'PATIENT_INVITATION_NOT_FOUND';
  end if;

  select lower(btrim(email)) into invited_user_email
  from auth.users
  where id = p_user_id;
  if invited_user_email is null then
    raise exception 'PATIENT_INVITATION_USER_NOT_FOUND';
  end if;
  if invited_user_email <> lower(btrim(invitation_record.email)) then
    raise exception 'PATIENT_INVITATION_EMAIL_MISMATCH';
  end if;

  if not exists (
    select 1 from public.organizations
    where id = invitation_record.organization_id and status = 'active'
  ) then
    raise exception 'PATIENT_INVITATION_ORGANIZATION_NOT_ACTIVE';
  end if;

  select subject.id into resolved_subject_id
  from public.subjects subject
  where subject.user_id = p_user_id and subject.subject_kind = 'person'
  for update;
  if resolved_subject_id is null then
    insert into public.subjects (subject_kind, user_id)
    values ('person', p_user_id)
    on conflict (user_id) do update set user_id = excluded.user_id
    returning id into resolved_subject_id;
  end if;

  select relationship.id, relationship.status into relationship_id, relationship_status
  from public.organization_patient_relationships relationship
  where relationship.organization_id = invitation_record.organization_id
    and relationship.subject_id = resolved_subject_id
  for update;

  if relationship_status = 'active' then
    raise exception 'PATIENT_RELATIONSHIP_ALREADY_ACTIVE';
  elsif relationship_id is null then
    insert into public.organization_patient_relationships (organization_id, subject_id, created_by)
    values (invitation_record.organization_id, resolved_subject_id, p_user_id)
    returning id into relationship_id;
  else
    update public.organization_patient_relationships
    set status = 'active', created_by = p_user_id, removed_by = null,
        removed_at = null, updated_at = timezone('utc', now())
    where id = relationship_id;
    relationship_reactivated := true;
  end if;

  update public.invitations
  set status = 'accepted', accepted_by = p_user_id, accepted_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = invitation_record.id;

  insert into public.audit_events (
    actor_user_id, organization_id, action, resource_type, resource_id, metadata
  )
  values
    (
      p_user_id, invitation_record.organization_id,
      case when relationship_reactivated then 'patient.relationship.reactivated' else 'patient.relationship.created' end,
      'organization_patient_relationship', relationship_id,
      jsonb_build_object('subject_id', resolved_subject_id, 'source', 'patient_invitation')
    ),
    (
      p_user_id, invitation_record.organization_id, 'patient.invitation.accepted', 'invitation', invitation_record.id,
      jsonb_build_object('invitation_type', 'patient_relationship', 'relationship_reactivated', relationship_reactivated)
    );

  return jsonb_build_object(
    'organization_id', invitation_record.organization_id,
    'relationship_id', relationship_id,
    'relationship_reactivated', relationship_reactivated
  );
end;
$$;

revoke all on function public.create_patient_relationship_invitation(uuid, text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_patient_relationship_invitation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.accept_patient_relationship_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.create_patient_relationship_invitation(uuid, text, uuid, text, timestamptz) to service_role;
grant execute on function public.revoke_patient_relationship_invitation(uuid, uuid, uuid) to service_role;
grant execute on function public.accept_patient_relationship_invitation(text, uuid) to service_role;
