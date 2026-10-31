# Assumptions & decisions

Where the build spec was ambiguous, the simplest safe option was chosen and recorded here.

## Platform

1. **Versions.** The spec names React 18 / React Router v6. The project uses current, non-vulnerable
   releases (React 19, React Router 7, Vite 8, Tailwind 4, Express 5, Zod 4): React Router 6 and
   Zod 3 have published security advisories. The APIs used are the same patterns the spec asks for.
2. **Single-service hosting.** Render serves both the API and the SPA from one origin. This keeps
   the `httpOnly` refresh cookie first-party and avoids proxy upload limits. A Vercel + Render
   option is documented.
3. **Service role scope.** The spec reserves the service role for admin actions. It is also used,
   server-side and only after the API has authorized the caller, for: storage objects and signed
   URLs (buckets have no client policies at all), quiz attempt creation and grading (students must
   never be able to write a score, and grading must read the answer key), audit-log rows,
   notifications and authorization lookups that distinguish 404 from 403. User data reads and
   writes still use the caller's JWT so RLS applies.

## Auth

4. **Refresh token** is stored only in an `httpOnly` cookie scoped to `/api/auth`; the access token is
   kept in memory. `POST /auth/refresh` returns 204 when there is no cookie (a signed-out visitor is
   not an error).
5. **Deactivation** sets `is_active = false`, bans the Supabase Auth user and deletes all sessions,
   so both new logins and old tokens fail immediately.
6. **Reset links** are Supabase recovery links (single-use, 1-hour expiry via `otp_expiry = 3600`).
   After a successful reset the API deletes **all** sessions, including the recovery session, so the
   link cannot be replayed and the old password stops working. Only tokens from an emailed one-time
   link (`amr = otp/recovery`) are accepted by `/auth/reset-password`.
7. **Forgot password** responds before the email is sent (fire-and-forget) so timing does not reveal
   whether the account exists.
8. **Temporary passwords**: while `must_change_password` is true, every endpoint except `/auth/*`
   returns `403 PASSWORD_CHANGE_REQUIRED` and the UI shows a forced change screen.
9. Role changes are blocked (409) while a user is still assigned to courses, to avoid a student
   appearing as a teacher of a course (or vice versa). Admins cannot change their own role/status.

## Courses & content

10. **Archived courses** disappear for teachers and students (403 on direct access) but stay fully
    visible to admins.
11. **CSV import** accepts emails separated by newlines, commas, semicolons or tabs, ignores an
    `email` header row, and reports `matched`, `alreadyEnrolled`, `duplicates` (repeated in the
    file), `unknown` (no active student with that email) and `invalid` (not an email). A `dryRun`
    preview is shown before enrolling.
12. **Assignment attachments** are stored in the `resources` bucket under
    `{course_id}/assignments/`. Editing an assignment does not replace the attachment.
13. **Lowering `max_marks`** below an existing grade is rejected (409).
14. A **submission** needs text, a file, or both. Resubmitting replaces the previous file and clears
    the grade.

## Quizzes

15. **Expiry** is `min(started_at + time_limit, closes_at)` and stored on the attempt.
16. A submission later than expiry + 10 s is **rejected (409)** and the attempt is closed with a score
    of **0**. Abandoned attempts are finalized with 0 the next time quizzes, results, marks or the
    gradebook are read.
17. **Shuffling** is deterministic per student (seeded by quiz + student), so resuming keeps the
    order. Students can read a quiz's questions only after starting an attempt.
18. After submitting, students see their score and which questions were correct, but never the
    correct options.
19. Deleting a quiz with attempts is blocked; unpublish it instead.

## Marks

20. Only **published** quizzes appear in the gradebook. Missing work (no submission) is shown as “—”
    and is excluded from totals, like pending work.

## Communication

21. **Admins** can read every classroom chat but do not post in them (the capability matrix lists
    admin chat access as “read all”). Admins can delete messages.
22. Deleted chat messages keep their row (`deleted_at`) and the API never returns their text.
23. **Complaint flow** is strictly `open → in_review → resolved | rejected`. Admins may save a response
    while a complaint is in review. Closed complaints cannot change.
24. The **in-app notice** for complaint status changes is a `notifications` table delivered through
    Realtime (bell icon), separate from announcements.
25. Rate limits use the in-memory store (one API instance). For several instances, swap in a shared
    store such as Redis.

## Data & UI

26. Admin pickers load up to 100 active teachers/students (ample for the prototype); search filters
    them client-side.
27. Demo users share the password `Gutech@2026`; the login page shows a demo-account helper that can
    be hidden with `VITE_SHOW_DEMO_ACCOUNTS=false`.
28. Seeded resources are not included because storage objects cannot be created from SQL; uploading
    one is part of the teacher walkthrough.
