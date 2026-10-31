# AI-assisted development workflow

The portal was built with **Claude Code** as an AI pair-programmer working directly in the
repository, following the _Internal LMS – AI Build Spec_ phase by phase. The human set the goal and
the spec; the AI wrote code, ran real infrastructure, and was required to prove each acceptance
criterion with a passing test before moving on.

## The loop

1. **Spec first.** The build spec PDF was the single source of truth: features, API table,
   permission matrix, schema and acceptance criteria. Ambiguities were resolved with the simplest
   safe option and logged in [`ASSUMPTIONS.md`](ASSUMPTIONS.md).
2. **Database before code.** Migrations, RLS policies and guard triggers were written first and
   applied to a **real local Supabase stack** (Docker). Before any API code existed, a student JWT
   was used to query PostgREST directly to confirm that answer keys, other students' submissions
   and other users' complaints were invisible.
3. **Generated types.** `supabase gen types` produced `database.types.ts`, so every repository
   query is type-checked against the live schema.
4. **Layered API.** routes → controllers → services → repositories, Zod on every input, one error
   envelope. Each feature was implemented end to end before the next.
5. **Tests against reality, not mocks only.** Route-contract tests (mocked services) prove every
   endpoint's role guard and validation; an integration suite runs every acceptance criterion
   against the real Supabase; Playwright drives a real browser for each role.
6. **UI.** shadcn-style components on Radix + Tailwind, built feature by feature with loading,
   empty and error states, then reviewed through automated screenshots at 1440 px and 360 px.
7. **Verify the production shape.** The production build was run in single-service mode (strict
   CSP) and the full E2E suite was re-run against it.

## Problems the AI caught by testing (and fixed)

| Symptom                                                                        | Root cause                                                                                                                                                                                                   | Fix                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Every login failed with “Email logins are disabled”                            | In Supabase config, `[auth.email].enable_signup` toggles the whole email _provider_; only `[auth].enable_signup` controls public sign-up                                                                     | Kept the email provider on, disabled sign-up globally; documented the trap in `config.toml` |
| Chat messages never arrived in the browser, though a Node script received them | `supabase-js` re-reads the Realtime token from its own (empty) auth session on heartbeats and fell back to the anon key; the anon role cannot see `chat_messages`, so the filtered subscription was rejected | Gave the browser client an `accessToken` callback that returns the in-memory user JWT       |
| A second Realtime join on the same topic failed under React StrictMode         | Re-joining a topic while the previous channel is closing is rejected                                                                                                                                         | Unique topic per subscription                                                               |
| `/signup` redirected to login instead of 404 for signed-out users              | The protected branch's catch-all matched first                                                                                                                                                               | Top-level catch-all that keeps the app shell only for signed-in users                       |
| `POST /api/signup` returned 401, not 404                                       | Auth middleware ran before routing                                                                                                                                                                           | Auth applied only to known protected prefixes                                               |
| Seeded code answers showed a literal `\n`                                      | Standard SQL strings don't process escapes                                                                                                                                                                   | `E'…'` strings in `seed.sql`                                                                |
| Dependency audit flagged Zod 3 and React Router 6                              | Published advisories                                                                                                                                                                                         | Upgraded to current majors and re-verified everything                                       |
| New React lint rules flagged state resets inside effects                       | Dialogs reset form state in `useEffect`                                                                                                                                                                      | Dialog bodies now mount fresh on open with lazy initial state — no effect needed            |

## Prompts that worked well

- _“Implement Feature N exactly as specified, including RLS, Zod schemas, service/repository code,
  UI with loading/empty/error states and tests. Then run the tests and report each acceptance
  criterion as PASS/FAIL with evidence; fix every FAIL before stopping.”_
- _“Act as a security reviewer: for each endpoint state what a student, a teacher of another
  course and an anonymous user get. Check for missing RLS, missing validation, leaked answer keys
  and unbounded queries.”_
- _“Query the database directly with a student's JWT and prove they cannot read the answer key.”_

## What the human still owns

- Creating the Supabase project and Render/Vercel services (accounts and secrets).
- Recording the walkthrough video ([script](VIDEO_SCRIPT.md)).
- Reviewing the assumptions and changing the demo passwords before sharing the URL publicly.
