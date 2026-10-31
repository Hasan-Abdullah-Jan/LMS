-- =============================================================================
-- 0008_auth_helpers.sql
-- Session revocation for the API (service role only). Used when an admin
-- deactivates a user or issues a temporary password, and after a password
-- reset/change so that every other device is signed out immediately.
-- Deleting a session cascades to its refresh tokens; access tokens tied to a
-- deleted session are rejected by auth.getUser().
-- =============================================================================

create or replace function public.revoke_user_sessions(
  target_user_id uuid,
  keep_session_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions
  where user_id = target_user_id
    and (keep_session_id is null or id <> keep_session_id)
$$;

revoke all on function public.revoke_user_sessions(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid, uuid) to service_role;
