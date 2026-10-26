# Northstar Learning

Internal learning management system built with React, TypeScript, Express, and Supabase.

## Local setup

1. Install Node.js 20+, npm, and the Supabase CLI.
2. Run npm install from the repository root.
3. Start local Supabase with supabase start.
4. Copy apps/api/.env.example to apps/api/.env and fill in the local API URL and keys printed by Supabase.
5. Copy apps/web/.env.example to apps/web/.env and fill in the local Supabase URL and anon key.
6. Run npm run db:reset to apply migrations and load demo accounts and courses.
7. Run npm run dev to start the API and web app.
8. Open http://localhost:5173. Local seed accounts use password Demo1234!.

Never put the service-role key in the web environment. Demo credentials are for local development only.

## Scripts

- npm run dev starts both workspaces.
- npm run build type-checks and builds the API and web app.
- npm run test runs workspace tests.
- npm run db:reset resets local Supabase, applies migrations, and loads seed data.

## Project layout

- apps/web: React single-page app
- apps/api: Express API
- supabase/migrations: ordered database schema and RLS migrations
- supabase/seed.sql: local demo data
- docs/ASSUMPTIONS.md: implementation decisions for ambiguous details

