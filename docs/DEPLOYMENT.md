# Deployment guide

## Vercel (recommended) — one project, one URL

The website and the API deploy together as a single Vercel project. `vercel.json` serves the React
build as static files and runs the Express API as one serverless function (`api/index.js`) behind
`/api/*`. Because both live on the same URL there is **no CORS, no cross-site cookie setup and no
URL variables to maintain**.

### 1. Supabase (once)

1. Open **SQL Editor → New query**, paste the whole file [`supabase/setup.sql`](../supabase/setup.sql)
   (all migrations + demo data) and press **Run**. Run it once, on an empty project.
2. **Authentication → Sign In / Providers**: keep **Email** on and turn **off** _Allow new users to
   sign up_. (Without this anyone could create an account straight against Supabase.)
3. **Project Settings → API**: copy the **Project URL**, the **anon / publishable key** and the
   **service_role / secret key**.

### 2. Vercel

1. **Add New → Project**, import the GitHub repo. Leave **Root Directory** at the repo root; the
   build settings come from `vercel.json`.
2. Add exactly these three **Environment Variables** (Production):

   | Name                        | Value                              |
   | --------------------------- | ---------------------------------- |
   | `SUPABASE_URL`              | Project URL                        |
   | `SUPABASE_ANON_KEY`         | anon / publishable key             |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key (secret) |

   The build reuses the URL and anon key for the browser (they are public values). The service-role
   key stays on the server and is never part of the web bundle.

3. **Deploy.** Open `https://<your-project>.vercel.app/api/health/ready`. It must show
   `serviceKey: ok`, `anonKey: ok`, `profiles` greater than 0 and `hint: All good.` — if not, the
   `hint` says which variable or setup step is wrong (**environment variables only apply to a new
   deployment, so redeploy after changing them**). Then sign in as `admin@gutech.demo` /
   `Gutech@2026`.

### Known limits on Vercel

- **Uploads are limited to ~4.5 MB per request** by Vercel's function platform (the API itself
  allows 25 MB). Normal PDFs, slides and images are fine; very large files need the Render option
  below.
- **Password-reset emails** need two things in Supabase that depend on your final URL: add
  `https://<your-project>.vercel.app/reset-password` under _Authentication → URL Configuration →
  Redirect URLs_, and configure custom SMTP (the built-in mailer only reaches team members). The
  rest of the app does not depend on this, and the API already points reset links at your Vercel
  production URL automatically. Admins can always set a temporary password instead.
- Rate limiting is per function instance (in-memory).

## Alternative: Render (single service, 25 MB uploads)

`render.yaml` is a Blueprint: **New → Blueprint**, pick the repo and fill in the three Supabase
variables above plus `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `CLIENT_ORIGIN` (your Render
URL) and `PASSWORD_RESET_REDIRECT` (`<your Render URL>/reset-password`). The service runs
`npm start` with `SERVE_WEB=true`, so Express serves both `/api/*` and the SPA.

## Post-deploy checklist

- [ ] `GET /api/health` returns `{"data":{"status":"ok",…}}`
- [ ] Sign in as `admin@gutech.demo` → lands on `/admin`; `/signup` shows the 404 page
- [ ] Teacher uploads a small PDF in CS101 → student downloads it
- [ ] Two browsers in the same course chat → messages appear instantly
- [ ] Student takes _Quiz 2_ → score shown; a second attempt is refused
- [ ] Change the demo passwords (or reseed) before sharing the URL publicly
