-- =============================================================================
-- 0009_api_grants.sql
-- Explicit table privileges for the Supabase API roles.
--
-- Row Level Security still decides which ROWS each user can see or change. These
-- grants only let the roles run the statements the API needs against the tables.
-- They are written out because a schema reset (supabase/reset-hosted.sql) removes
-- the default privileges that Supabase otherwise applies to new tables.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Anonymous visitors never read or write application data.
revoke all on all tables in schema public from anon;

-- Users may only mark their own notifications as read.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
