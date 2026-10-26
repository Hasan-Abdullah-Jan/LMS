# Assumptions

- The repository starts empty, so Phase 0 creates the requested npm workspace monorepo.
- Local Supabase CLI is the intended database workflow; production credentials are supplied through environment variables.
- The seed data is development-only and uses deterministic UUIDs for profiles expected to be created in Supabase Auth. Create matching Auth users locally before applying profile seed rows, or use the documented bootstrap script in a later phase.
- RLS protects user-scoped access. Privileged account creation and reset operations use a server-only service-role client.
- Quiz retakes are disabled, quiz questions are text-only, marks release when grading is saved, and notifications are in-app only, following the final checklist defaults.
