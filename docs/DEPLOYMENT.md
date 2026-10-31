# Deployment guide

The app needs three things: a **Supabase project**, the **Node API**, and the **React build**.
The recommended setup runs the API and the built SPA as **one Render web service** — same origin,
so the refresh cookie is first-party, no CORS, and 25 MB uploads go straight to Node.

---

## 1. Supabase (database, auth, storage, realtime)

1. Create a project at <https://supabase.com/dashboard> (pick a region close to your users,
   e.g. _Frankfurt_ or _Mumbai_ for Oman).
2. **Disable public sign-up.** _Authentication → Sign In / Providers_: keep **Email** enabled,
   turn **off** “Allow new users to sign up”. Users are created only by an admin through the API.
3. **URLs.** _Authentication → URL Configuration_:
   - Site URL: `https://<your-app>.onrender.com`
   - Redirect URLs: `https://<your-app>.onrender.com/reset-password`
4. **Schema + demo data.** From the repo root:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npm run db:push
   ```
   `db:push` applies `supabase/migrations/*` in order and runs `supabase/seed.sql`.
   _Alternative:_ paste each migration file (0001 → 0008) and then `seed.sql` into the SQL Editor.
5. **Keys.** _Project Settings → API Keys_: copy the project URL, the **publishable/anon** key and
   the **secret/service_role** key. The secret key goes **only** into the API environment.
6. **Email (optional but recommended).** Supabase's built-in mailer only delivers to project team
   members and is heavily rate-limited. For real password-reset emails configure custom SMTP
   (_Authentication → Emails → SMTP Settings_), e.g. Resend, Postmark or SendGrid.

Realtime needs no extra setup: migration `0007` adds `chat_messages`, `announcements` and
`notifications` to the `supabase_realtime` publication, and RLS filters what each user receives.

## 2a. Render — single service (recommended)

1. Push this repository to GitHub.
2. In Render: **New → Blueprint**, pick the repository. Render reads [`render.yaml`](../render.yaml).
3. Fill in the variables marked _sync: false_:

   | Variable                    | Value                                            |
   | --------------------------- | ------------------------------------------------ |
   | `SUPABASE_URL`              | `https://<ref>.supabase.co`                      |
   | `SUPABASE_ANON_KEY`         | publishable / anon key                           |
   | `SUPABASE_SERVICE_ROLE_KEY` | secret / service_role key                        |
   | `VITE_SUPABASE_URL`         | same as `SUPABASE_URL`                           |
   | `VITE_SUPABASE_ANON_KEY`    | same as `SUPABASE_ANON_KEY`                      |
   | `CLIENT_ORIGIN`             | `https://<your-app>.onrender.com`                |
   | `PASSWORD_RESET_REDIRECT`   | `https://<your-app>.onrender.com/reset-password` |

4. Deploy. The build runs `npm ci --include=dev && npm run build`; the start command is
   `npm start` with `SERVE_WEB=true`, so Express serves `/api/*` and the SPA for every other path.
5. Health check: `https://<your-app>.onrender.com/api/health`.

> The free Render plan sleeps after inactivity; the first request can take ~30–60 s. Open the site
> a minute before a demo.

_Manual (no blueprint):_ create a **Web Service**, runtime Node, build
`npm ci --include=dev && npm run build`, start `npm start`, health check `/api/health`, and add the
variables above plus `NODE_ENV=production`, `SERVE_WEB=true`, `VITE_API_URL=/api`,
`COOKIE_SAMESITE=lax`.

## 2b. Vercel (web) + Render (API)

Use this if you specifically want the frontend on Vercel.

1. **API on Render** as in 2a, but set `SERVE_WEB=false` and
   `CLIENT_ORIGIN=https://<your-web>.vercel.app`.
2. **Proxy `/api` through Vercel** so the cookie stays first-party: edit
   [`apps/web/vercel.json`](../apps/web/vercel.json) and put this rule **before** the SPA rewrite:
   ```json
   { "source": "/api/:path*", "destination": "https://<your-api>.onrender.com/api/:path*" }
   ```
3. **Web on Vercel:** _Add New → Project_, import the repo, set **Root Directory** to `apps/web`
   (framework: Vite). Environment variables: `VITE_API_URL=/api`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`.
4. Set Supabase _Site URL_ / _Redirect URLs_ and the API's `PASSWORD_RESET_REDIRECT` to the Vercel
   domain.

_Without the rewrite_ you can point `VITE_API_URL` at `https://<your-api>.onrender.com/api` and set
`COOKIE_SAMESITE=none` on the API. This works, but browsers that block third-party cookies
(Safari) will ask users to sign in again after a page reload.

## 3. Post-deploy checklist

- [ ] `GET /api/health` returns `{"data":{"status":"ok",…}}`
- [ ] Sign in as `admin@gutech.demo` / `Gutech@2026` → lands on `/admin`
- [ ] `/signup` shows the 404 page
- [ ] Teacher uploads a PDF in CS101 → student downloads it
- [ ] Two browsers in the same course chat → messages appear instantly
- [ ] Student takes _Quiz 2_ → score shown; a second attempt is refused
- [ ] Forgot-password email arrives (custom SMTP) and the link works once
- [ ] Change the demo passwords (or reseed) before sharing the URL publicly
