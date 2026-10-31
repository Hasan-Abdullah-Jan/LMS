# Testing & acceptance evidence

| Suite                           | Command                    | Needs                              | Result                                                           |
| ------------------------------- | -------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| API unit + route contracts      | `npm test`                 | nothing                            | **147 passed**                                                   |
| Web unit                        | `npm test`                 | nothing                            | **7 passed**                                                     |
| API integration (real Supabase) | `npm run test:integration` | `npm run db:reset`                 | **41 passed**                                                    |
| Playwright E2E                  | `npm run test:e2e`         | `npm run db:reset` + `npm run dev` | **10 passed** (also against the production single-service build) |

Every API endpoint has a happy-path test and a permission-denied test in
`apps/api/tests/routes.test.ts`. The integration suite
(`apps/api/tests/integration/acceptance.int.test.ts`) maps one-to-one onto the spec's acceptance
criteria below. All results above are from a clean `supabase db reset`.

## Acceptance criteria

### Feature 1 — Login

| Criterion                                                      | Status | Evidence                                                                                                                                                               |
| -------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid login redirects by role; invalid shows the generic error | PASS   | integration _“valid login returns tokens…”_, _“invalid login shows the same generic error…”_; E2E _auth › each role lands on its own dashboard_, _invalid credentials_ |
| `/signup` returns 404 and Supabase sign-ups are disabled       | PASS   | integration _“/signup returns 404…”_ (also calls `supabase.auth.signUp` → error); E2E _there is no sign-up page or link_                                               |
| Deactivated user cannot log in or reuse an old token           | PASS   | integration _“a deactivated user cannot log in or reuse an old token…”_                                                                                                |
| Protected route logged-out redirects to `/login`               | PASS   | E2E _protected routes redirect to /login_; integration 401 checks                                                                                                      |
| First login with a temp password forces a change               | PASS   | integration (403 `PASSWORD_CHANGE_REQUIRED`); E2E _temporary password forces a password change_                                                                        |

### Feature 2 — Resources

| Criterion                                                 | Status | Evidence                                                                                                  |
| --------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Teacher cannot upload to a course they do not teach (403) | PASS   | integration _“teacher cannot upload to a course they do not teach”_                                       |
| Student not enrolled gets 403 on list and download        | PASS   | integration _“a student who is not enrolled gets 403…”_                                                   |
| 30 MB file or `.exe` rejected with a clear message        | PASS   | integration _“rejects a 30 MB file and a renamed .exe”_ (413 / 415 with messages); unit _file validation_ |
| Deleting a resource removes the storage object            | PASS   | integration _“deleting a resource removes the storage object”_                                            |

### Feature 3 — Courses & enrollment

| Criterion                                                | Status | Evidence                                                                                         |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| Enrolling the same student twice is idempotent           | PASS   | integration _“…enrolling twice is idempotent”_                                                   |
| CSV import reports matched, duplicate and unknown emails | PASS   | integration _“CSV import reports matched, duplicate, and unknown emails (with dry-run preview)”_ |
| Student sees only enrolled, non-archived courses         | PASS   | integration _“students see only enrolled, non-archived courses”_                                 |

### Feature 4 — Assignments

| Criterion                                           | Status | Evidence                                                                  |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Late submission blocked or flagged per `allow_late` | PASS   | integration _“late submission is blocked … and flagged when allowed”_     |
| Marks above `max_marks` rejected (422)              | PASS   | integration _“marks above max_marks are rejected (422)…”_                 |
| Student can never read another student's submission | PASS   | integration (API 403 **and** direct Supabase query returns only own rows) |

### Feature 5 — Quizzes

| Criterion                                                | Status | Evidence                                                                               |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Attempt response contains no answer key                  | PASS   | integration (response JSON has no `correct`); direct `quiz_answers` query returns `[]` |
| A second attempt is rejected (409)                       | PASS   | integration _“a second attempt is rejected (409)”_; E2E student flow                   |
| Submission after expiry rejected or scored 0             | PASS   | integration _“submission after expiry is rejected and scored 0”_                       |
| Score equals the sum of marks of fully-correct questions | PASS   | integration (4/6 with a partially-correct multi-select); unit _quiz grading_           |

### Feature 6 — Announcements

| Criterion                                             | Status | Evidence                                                                               |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Student sees global + own-course announcements only   | PASS   | integration _“a student sees global plus own-course announcements only, pinned first”_ |
| Teacher cannot post to an untaught course or globally | PASS   | integration _“a teacher cannot post to a course they do not teach or post global”_     |
| Pinned items always sort first                        | PASS   | same integration test                                                                  |

### Feature 7 — Marks

| Criterion                                                 | Status | Evidence                                                                  |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| A student can never request another student's marks (403) | PASS   | integration _“a student can never request another student's marks (403)”_ |
| Totals match a manual calculation on seeded data          | PASS   | integration: Yousuf CS101 = (7 + 3) / (10 + 6) = **62.5 %**               |
| CSV opens correctly in Excel (UTF-8 BOM)                  | PASS   | integration checks bytes `EF BB BF` and `text/csv`                        |

### Feature 8 — Chat

| Criterion                                               | Status | Evidence                                                                                       |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| Message from A appears for B within 2 s without refresh | PASS   | E2E _chat: a message from one user appears for another within 2 seconds_ (two browsers)        |
| Non-member cannot read, send or subscribe               | PASS   | integration (API 403 + direct RLS query returns nothing; Realtime uses the same SELECT policy) |
| HTML in the body is rendered as text                    | PASS   | integration (stored verbatim) + E2E (no `<b>` element rendered)                                |

### Feature 9 — Complaints

| Criterion                                               | Status | Evidence                                                                             |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Users see only their own complaints; others get 403/404 | PASS   | integration _“users see only their own complaints; others get 404”_                  |
| Resolving without a response is rejected (422)          | PASS   | integration _“resolving without a response is rejected (422)…”_                      |
| Attachment in a private bucket, delivered by signed URL | PASS   | integration _“attachments go to the private bucket and are delivered by signed URL”_ |

### Feature 10 — Password reset

| Criterion                                                                   | Status | Evidence                                                                              |
| --------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| Unknown and known email give identical responses                            | PASS   | integration (bodies deep-equal; email sent asynchronously)                            |
| Expired or reused link shows a clear error with a link to request a new one | PASS   | integration (reuse → 400 `LINK_INVALID`); UI expired state with _Request a new link_  |
| Old password stops working immediately after a reset                        | PASS   | integration _“reset works once; a reused link fails; the old password stops working”_ |

## Final checklist

- [x] All 10 features meet their acceptance criteria
- [x] No sign-up route or UI exists anywhere
- [x] A student cannot read another student's marks, submissions, complaints or any quiz answer key (verified by tests)
- [x] RLS is enabled on every table; the service-role key is absent from the web bundle
- [x] Seeded demo data lets a reviewer walk all three roles end to end
- [x] `npm run test` is green; one Playwright flow per role passes
- [x] README setup works on a clean machine (≤ 10 steps)
