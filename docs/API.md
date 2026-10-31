# API reference

Base URL: `/api`. All bodies are JSON unless noted _(multipart)_. Authenticated routes need
`Authorization: Bearer <access token>`. Lists accept `?page=1&pageSize=20` (max 100) and return
`{ data, meta: { page, pageSize, total } }`.

Status codes: `200/201/204` success · `400` malformed · `401` not signed in · `403` wrong role or
not a member · `404` not found (also hides existence) · `409` conflict (duplicate, late, second
attempt, locked) · `413` file too large · `415` file type not allowed · `422` validation · `429`
rate limited.

## Auth

| Method | Path                    | Access         | Notes                                                                                                           |
| ------ | ----------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/login`           | Public         | `{ email, password }` → `{ accessToken, expiresAt, user }` + refresh cookie. 5 attempts / 15 min per IP + email |
| POST   | `/auth/refresh`         | Cookie         | New access token; `204` when no cookie                                                                          |
| POST   | `/auth/logout`          | Auth           | Revokes the session, clears the cookie                                                                          |
| GET    | `/auth/me`              | Auth           | Current profile                                                                                                 |
| POST   | `/auth/forgot-password` | Public         | `{ email }` → always the same `200` message. 3 / hour / email                                                   |
| POST   | `/auth/reset-password`  | Recovery token | `{ newPassword }`; revokes all sessions                                                                         |
| POST   | `/auth/change-password` | Auth           | `{ currentPassword, newPassword }`; signs out other sessions                                                    |

Password policy: ≥ 10 characters with at least one letter and one number.

## Admin (role `admin`)

| Method      | Path                                                  | Notes                                                                                                                            |
| ----------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GET         | `/admin/users?search=&role=&status=active\|inactive`  | Paginated                                                                                                                        |
| POST        | `/admin/users`                                        | `{ fullName, email, role, rollNo?, temporaryPassword }` → `must_change_password = true`                                          |
| GET / PATCH | `/admin/users/:id`                                    | `{ fullName?, role?, rollNo?, isActive? }` (deactivation bans + revokes sessions)                                                |
| POST        | `/admin/users/:id/reset-password`                     | `{ mode: "email" }` or `{ mode: "temporary", temporaryPassword }`                                                                |
| GET / POST  | `/admin/courses?search=&status=active\|archived\|all` | `{ code, title, description? }`                                                                                                  |
| GET / PATCH | `/admin/courses/:id`                                  | Detail with students; `{ code?, title?, description?, isArchived? }`                                                             |
| PUT         | `/admin/courses/:id/teachers`                         | `{ teacherIds[] }` — replaces the set                                                                                            |
| POST        | `/admin/courses/:id/enrollments?dryRun=`              | `{ studentIds[] }` or `{ csv }` or _(multipart `file`)_ → `{ enrolled, matched, alreadyEnrolled, duplicates, unknown, invalid }` |
| DELETE      | `/admin/courses/:id/enrollments/:studentId`           | Unenroll                                                                                                                         |
| GET         | `/admin/complaints?status=&category=&search=`         | Queue                                                                                                                            |
| PATCH       | `/admin/complaints/:id`                               | `{ status?, adminResponse? }` — response required for resolved/rejected (422)                                                    |
| GET         | `/admin/audit-log`                                    | Paginated                                                                                                                        |

## Me

| Method | Path                  | Access  | Notes                                                              |
| ------ | --------------------- | ------- | ------------------------------------------------------------------ |
| GET    | `/me/courses`         | Auth    | Students: enrolled; teachers: taught; admins: all active           |
| GET    | `/me/marks?courseId=` | Student | Own marks per course with totals; `studentId` of anyone else → 403 |
| GET    | `/me/dashboard`       | Auth    | Role-specific summary                                              |

## Courses

| Method | Path                                     | Access                 | Notes                                                                        |
| ------ | ---------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| GET    | `/courses/:id`                           | Member                 | Includes `myRole`                                                            |
| GET    | `/courses/:id/members`                   | Member                 | Teachers + students (contact details hidden from students)                   |
| GET    | `/courses/:id/resources?search=`         | Member                 | Paginated                                                                    |
| POST   | `/courses/:id/resources`                 | Teacher (own) / Admin  | _(multipart)_ `title, description?, file` — 25 MB, PDF/DOCX/PPTX/ZIP/images  |
| GET    | `/courses/:id/assignments`               | Member                 | Students get `status` + own `submission`; staff get `stats`                  |
| POST   | `/courses/:id/assignments`               | Teacher (own)          | _(multipart)_ `title, instructions, maxMarks, dueAt, allowLate, attachment?` |
| GET    | `/courses/:id/quizzes`                   | Member                 | Students see published quizzes with `status` and `myAttempt`                 |
| POST   | `/courses/:id/quizzes`                   | Teacher (own)          | Quiz + questions + correct answers                                           |
| GET    | `/courses/:id/messages?before=&limit=50` | Member                 | Cursor pagination (`meta.nextBefore`)                                        |
| POST   | `/courses/:id/messages`                  | Teacher/Student member | `{ body }` 1–2000 chars; 20/min/user                                         |
| GET    | `/courses/:id/gradebook`                 | Teacher (own) / Admin  | Students × items with totals                                                 |
| GET    | `/courses/:id/gradebook.csv`             | Teacher (own) / Admin  | UTF-8 BOM CSV                                                                |

## Items

| Method               | Path                                             | Access                             | Notes                                                                                                                |
| -------------------- | ------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| GET                  | `/resources/:id/download`                        | Member                             | `{ url, fileName, expiresIn: 60 }`                                                                                   |
| DELETE               | `/resources/:id`                                 | Uploader / Admin                   | Removes row and storage object                                                                                       |
| GET / PATCH / DELETE | `/assignments/:id`                               | Member / Teacher (own)             | PATCH `{ title?, instructions?, maxMarks?, dueAt?, allowLate? }`                                                     |
| GET                  | `/assignments/:id/attachment`                    | Member                             | Signed URL                                                                                                           |
| PUT                  | `/assignments/:id/submission`                    | Student (enrolled)                 | _(multipart)_ `textAnswer?, file?` — late → 409 unless `allowLate`                                                   |
| GET                  | `/assignments/:id/submissions`                   | Teacher (own)                      | Every enrolled student with their submission                                                                         |
| PATCH                | `/submissions/:id/grade`                         | Teacher (own)                      | `{ marks, feedback? }`; marks outside `0..maxMarks` → 422                                                            |
| GET                  | `/submissions/:id/file`                          | Owner / Teacher                    | Signed URL                                                                                                           |
| GET / PATCH / DELETE | `/quizzes/:id`                                   | Member / Teacher (own)             | Edits blocked once attempts exist (409); publishing always allowed                                                   |
| POST                 | `/quizzes/:id/attempt`                           | Student                            | Start or resume; questions **without answers**, `startedAt`, `expiresAt`, `serverTime`                               |
| POST                 | `/quizzes/:id/attempt/submit`                    | Student                            | `{ answers: { [questionId]: optionIds[] } }` → score; second attempt 409; after time + 10 s grace → 409 and scored 0 |
| GET                  | `/quizzes/:id/results`                           | Teacher (own)                      | All students' attempts and scores                                                                                    |
| GET / POST           | `/announcements?courseId=\|global`               | Auth / Teacher, Admin              | `{ courseId?, title, body, isPinned }` — null `courseId` is admin-only                                               |
| GET                  | `/announcements/unread-count`                    | Auth                               |                                                                                                                      |
| POST                 | `/announcements/read`                            | Auth                               | `{ upTo? }` — mark read up to a timestamp                                                                            |
| PATCH / DELETE       | `/announcements/:id`                             | Author / Admin                     |                                                                                                                      |
| DELETE               | `/messages/:id`                                  | Sender (≤ 5 min) / Teacher / Admin | Soft delete                                                                                                          |
| POST                 | `/complaints`                                    | Student / Teacher                  | _(multipart)_ `category, subject, description, courseId?, attachment?` (10 MB)                                       |
| GET                  | `/complaints/mine`                               | Student / Teacher                  |                                                                                                                      |
| GET                  | `/complaints/:id`                                | Owner / Admin                      | Others → 404                                                                                                         |
| POST                 | `/complaints/:id/follow-up`                      | Owner                              | `{ comment }` — once                                                                                                 |
| GET                  | `/complaints/:id/attachment`                     | Owner / Admin                      | Signed URL                                                                                                           |
| GET                  | `/notifications` · `/notifications/unread-count` | Auth                               |                                                                                                                      |
| POST                 | `/notifications/read-all`                        | Auth                               |                                                                                                                      |
| GET                  | `/health`                                        | Public                             | Liveness                                                                                                             |
