-- =============================================================================
-- GUTECH LMS - RESET (demo projects only)
--
-- Deletes ALL application data and the demo accounts (@gutech.demo), so that
-- supabase/setup.sql can be run again on a clean database.
--
-- Use it only when setup.sql already ran once and failed or was run twice
-- (for example: ERROR 42710: type "user_role" already exists).
--
-- Order: 1) run this file   2) run supabase/setup.sql
-- =============================================================================

-- Application schema: drops every table, type, function and view created by setup.sql.
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

-- Demo accounts. Deleting auth.users cascades to auth identities and sessions.
delete from auth.users where email like '%@gutech.demo';
