-- Backend-authoritative access: avoid recursive self-referencing membership RLS.
-- The backend service role resolves organization membership and the client may
-- read only its own membership until a scoped member-list policy is introduced.

drop policy if exists organization_members_select_same_org on public.organization_members;
