/**
 * End-to-end acceptance criteria from the build spec, executed against a real
 * Supabase instance (migrations + seed). Run with: npm run test:integration
 */
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { api, auth, COURSES, forget, IDS, login, pdfBuffer, USERS } from './helpers.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

describe('Deployment self-check', () => {
  it('/api/health/ready reports working keys and a populated database without leaking secrets', async () => {
    const res = await api().get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      api: 'ok',
      serviceKey: 'ok',
      anonKey: 'ok',
      hint: 'All good.',
    });
    expect(res.body.data.profiles).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain(serviceKey);
  });
});

describe('Feature 1 - Login (no sign-up)', () => {
  it('valid login returns tokens and the profile with role; refresh token is an httpOnly cookie', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: USERS.aisha, password: 'Gutech@2026' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('teacher');
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.headers['set-cookie']?.[0]).toMatch(/gutech_lms_rt=.+HttpOnly/i);
  });

  it('invalid login shows the same generic error for wrong password and unknown email', async () => {
    const wrongPassword = await api()
      .post('/api/auth/login')
      .send({ email: USERS.aisha, password: 'nope' });
    const unknownEmail = await api()
      .post('/api/auth/login')
      .send({ email: 'ghost@gutech.demo', password: 'nope' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe('Invalid email or password.');
    expect(unknownEmail.body.error.message).toBe('Invalid email or password.');
  });

  it('/signup returns 404 and Supabase sign-ups are disabled', async () => {
    expect((await api().post('/api/signup').send({})).status).toBe(404);
    expect((await api().post('/api/auth/signup').send({})).status).toBe(404);
    const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.auth.signUp({
      email: `x${unique()}@gutech.demo`,
      password: 'Abcdefgh123',
    });
    expect(error).not.toBeNull();
  });

  it('protected routes without a token return 401', async () => {
    expect((await api().get('/api/me/courses')).status).toBe(401);
    expect((await api().get('/api/admin/users')).status).toBe(401);
  });

  it('refresh exchanges the cookie for a new access token', async () => {
    const agent = api();
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: USERS.omar, password: 'Gutech@2026' });
    const cookie = loginRes.headers['set-cookie'] as unknown as string[];
    const res = await api().post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(USERS.omar);
  });

  it('a deactivated user cannot log in or reuse an old token; admin can reactivate', async () => {
    const admin = await login(USERS.admin);
    const email = `temp.${unique().toLowerCase()}@gutech.demo`;
    const created = await api().post('/api/admin/users').set(auth(admin)).send({
      fullName: 'Temp Student',
      email,
      role: 'student',
      temporaryPassword: 'Welcome2026x',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.mustChangePassword).toBe(true);

    const userToken = (
      await api().post('/api/auth/login').send({ email, password: 'Welcome2026x' })
    ).body.data.accessToken;
    // Temporary password: everything except auth endpoints is blocked.
    const blocked = await api().get('/api/me/courses').set(auth(userToken));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const off = await api()
      .patch(`/api/admin/users/${created.body.data.id}`)
      .set(auth(admin))
      .send({ isActive: false });
    expect(off.status).toBe(200);
    expect((await api().get('/api/auth/me').set(auth(userToken))).status).toBe(401);
    const relogin = await api().post('/api/auth/login').send({ email, password: 'Welcome2026x' });
    expect(relogin.status).toBe(403);
    expect(relogin.body.error.code).toBe('ACCOUNT_DEACTIVATED');

    const on = await api()
      .patch(`/api/admin/users/${created.body.data.id}`)
      .set(auth(admin))
      .send({ isActive: true });
    expect(on.status).toBe(200);
    expect(
      (await api().post('/api/auth/login').send({ email, password: 'Welcome2026x' })).status,
    ).toBe(200);
  });

  it('non-admins cannot manage users (403)', async () => {
    const teacher = await login(USERS.aisha);
    expect((await api().get('/api/admin/users').set(auth(teacher))).status).toBe(403);
    expect(
      (
        await api()
          .post('/api/admin/users')
          .set(auth(teacher))
          .send({ fullName: 'X Y', email: 'x@y.z', role: 'admin', temporaryPassword: 'Abcdefgh12' })
      ).status,
    ).toBe(403);
  });
});

describe('Feature 2 - Resources', () => {
  it('teacher uploads to own course; enrolled student lists and downloads via a 60s signed URL', async () => {
    const teacher = await login(USERS.aisha);
    const upload = await api()
      .post(`/api/courses/${COURSES.cs101}/resources`)
      .set(auth(teacher))
      .field('title', 'Week 1 slides')
      .attach('file', pdfBuffer(), { filename: 'week1.pdf', contentType: 'application/pdf' });
    expect(upload.status).toBe(201);
    expect(upload.body.data.mimeType).toBe('application/pdf');
    expect(upload.body.data).not.toHaveProperty('filePath');

    const student = await login(USERS.fatima);
    const list = await api()
      .get(`/api/courses/${COURSES.cs101}/resources?search=week`)
      .set(auth(student));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const dl = await api().get(`/api/resources/${upload.body.data.id}/download`).set(auth(student));
    expect(dl.status).toBe(200);
    expect(dl.body.data.expiresIn).toBe(60);
    expect(dl.body.data.url).toContain('token=');
  });

  it('teacher cannot upload to a course they do not teach (403)', async () => {
    const teacher = await login(USERS.aisha);
    const res = await api()
      .post(`/api/courses/${COURSES.cs201}/resources`)
      .set(auth(teacher))
      .field('title', 'Nope')
      .attach('file', pdfBuffer(), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });

  it('a student who is not enrolled gets 403 on list and download', async () => {
    const teacher = await login(USERS.omar);
    const upload = await api()
      .post(`/api/courses/${COURSES.cs201}/resources`)
      .set(auth(teacher))
      .field('title', 'CS201 notes')
      .attach('file', pdfBuffer(), { filename: 'notes.pdf', contentType: 'application/pdf' });
    expect(upload.status).toBe(201);

    const salim = await login(USERS.salim); // not in CS201
    expect(
      (await api().get(`/api/courses/${COURSES.cs201}/resources`).set(auth(salim))).status,
    ).toBe(403);
    expect(
      (await api().get(`/api/resources/${upload.body.data.id}/download`).set(auth(salim))).status,
    ).toBe(403);
  });

  it('rejects a 30 MB file and a renamed .exe with clear messages', async () => {
    const teacher = await login(USERS.aisha);
    const big = await api()
      .post(`/api/courses/${COURSES.cs101}/resources`)
      .set(auth(teacher))
      .field('title', 'Too big')
      .attach('file', pdfBuffer(30 * 1024 * 1024), {
        filename: 'big.pdf',
        contentType: 'application/pdf',
      });
    expect(big.status).toBe(413);
    expect(big.body.error.message).toMatch(/25 MB/);

    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(4096, 0x90)]);
    const bad = await api()
      .post(`/api/courses/${COURSES.cs101}/resources`)
      .set(auth(teacher))
      .field('title', 'Virus')
      .attach('file', exe, { filename: 'setup.pdf', contentType: 'application/pdf' });
    expect(bad.status).toBe(415);
    expect(bad.body.error.message).toMatch(/not an allowed file type/);
  });

  it('deleting a resource removes the storage object', async () => {
    const teacher = await login(USERS.aisha);
    const upload = await api()
      .post(`/api/courses/${COURSES.cs101}/resources`)
      .set(auth(teacher))
      .field('title', 'Temp')
      .attach('file', pdfBuffer(), { filename: 'temp.pdf', contentType: 'application/pdf' });
    const { data: row } = await service
      .from('resources')
      .select('file_path')
      .eq('id', upload.body.data.id)
      .single();
    const del = await api().delete(`/api/resources/${upload.body.data.id}`).set(auth(teacher));
    expect(del.status).toBe(204);
    const { data: signed } = await service.storage
      .from('resources')
      .createSignedUrl(row!.file_path, 60);
    expect(signed).toBeNull();
  });
});

describe('Feature 3 - Courses and enrollment', () => {
  it('admin creates a course, assigns teachers; enrolling twice is idempotent', async () => {
    const admin = await login(USERS.admin);
    const code = `T${unique()}`;
    const course = await api()
      .post('/api/admin/courses')
      .set(auth(admin))
      .send({ code, title: 'Test Course' });
    expect(course.status).toBe(201);
    const id = course.body.data.id;

    const { data: teacher } = await service
      .from('profiles')
      .select('id')
      .eq('email', USERS.aisha)
      .single();
    const teachers = await api()
      .put(`/api/admin/courses/${id}/teachers`)
      .set(auth(admin))
      .send({ teacherIds: [teacher!.id] });
    expect(teachers.status).toBe(200);
    expect(teachers.body.data.teachers).toHaveLength(1);

    const first = await api()
      .post(`/api/admin/courses/${id}/enrollments`)
      .set(auth(admin))
      .send({ studentIds: [IDS.fatima] });
    const second = await api()
      .post(`/api/admin/courses/${id}/enrollments`)
      .set(auth(admin))
      .send({ studentIds: [IDS.fatima] });
    expect(first.status).toBe(201);
    expect(first.body.data.enrolled).toBe(1);
    expect(second.status).toBe(201);
    expect(second.body.data.enrolled).toBe(0);
    expect(second.body.data.alreadyEnrolled).toEqual([USERS.fatima]);
  });

  it('CSV import reports matched, duplicate, and unknown emails (with dry-run preview)', async () => {
    const admin = await login(USERS.admin);
    const course = await api()
      .post('/api/admin/courses')
      .set(auth(admin))
      .send({ code: `C${unique()}`, title: 'CSV Course' });
    const csv = `email\n${USERS.yousuf}\n${USERS.salim}\n${USERS.yousuf}\nnobody@gutech.demo\nnot-an-email\n`;
    const preview = await api()
      .post(`/api/admin/courses/${course.body.data.id}/enrollments?dryRun=true`)
      .set(auth(admin))
      .attach('file', Buffer.from(csv), { filename: 'students.csv', contentType: 'text/csv' });
    expect(preview.status).toBe(200);
    expect(preview.body.data.matched.map((m: { email: string }) => m.email).sort()).toEqual(
      [USERS.salim, USERS.yousuf].sort(),
    );
    expect(preview.body.data.duplicates).toEqual([USERS.yousuf]);
    expect(preview.body.data.unknown).toEqual(['nobody@gutech.demo']);
    expect(preview.body.data.invalid).toEqual(['not-an-email']);
    expect(preview.body.data.enrolled).toBe(0);

    const commit = await api()
      .post(`/api/admin/courses/${course.body.data.id}/enrollments`)
      .set(auth(admin))
      .send({ csv });
    expect(commit.body.data.enrolled).toBe(2);
  });

  it('students see only enrolled, non-archived courses', async () => {
    const admin = await login(USERS.admin);
    const course = await api()
      .post('/api/admin/courses')
      .set(auth(admin))
      .send({ code: `A${unique()}`, title: 'Archived soon' });
    await api()
      .post(`/api/admin/courses/${course.body.data.id}/enrollments`)
      .set(auth(admin))
      .send({ studentIds: [IDS.salim] });
    const salim = await login(USERS.salim);
    let mine = await api().get('/api/me/courses').set(auth(salim));
    expect(mine.body.data.map((c: { id: string }) => c.id)).toContain(course.body.data.id);

    await api()
      .patch(`/api/admin/courses/${course.body.data.id}`)
      .set(auth(admin))
      .send({ isArchived: true });
    mine = await api().get('/api/me/courses').set(auth(salim));
    const ids = mine.body.data.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(course.body.data.id);
    expect(ids).not.toContain(COURSES.cs201);
    expect((await api().get(`/api/courses/${course.body.data.id}`).set(auth(salim))).status).toBe(
      403,
    );
  });
});

describe('Feature 4 - Assignments', () => {
  it('student submits before the deadline; resubmission clears the grade', async () => {
    const student = await login(USERS.fatima);
    const res = await api()
      .put(`/api/assignments/${IDS.lab2}/submission`)
      .set(auth(student))
      .field('textAnswer', 'v2');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('submitted');
    expect(res.body.data.marksObtained).toBeNull();
  });

  it('late submission is blocked when allow_late = false and flagged when allowed', async () => {
    const teacher = await login(USERS.aisha);
    const past = new Date(Date.now() - 60_000).toISOString();
    const strict = await api()
      .post(`/api/courses/${COURSES.cs101}/assignments`)
      .set(auth(teacher))
      .field('title', 'Closed')
      .field('instructions', 'x')
      .field('maxMarks', '10')
      .field('dueAt', past)
      .field('allowLate', 'false');
    const lenient = await api()
      .post(`/api/courses/${COURSES.cs101}/assignments`)
      .set(auth(teacher))
      .field('title', 'Late ok')
      .field('instructions', 'x')
      .field('maxMarks', '10')
      .field('dueAt', past)
      .field('allowLate', 'true');
    expect(strict.status).toBe(201);

    const student = await login(USERS.yousuf);
    const blocked = await api()
      .put(`/api/assignments/${strict.body.data.id}/submission`)
      .set(auth(student))
      .field('textAnswer', 'late');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('DEADLINE_PASSED');

    const flagged = await api()
      .put(`/api/assignments/${lenient.body.data.id}/submission`)
      .set(auth(student))
      .field('textAnswer', 'late');
    expect(flagged.status).toBe(200);
    expect(flagged.body.data.isLate).toBe(true);
    expect(flagged.body.data.status).toBe('late');
  });

  it('marks above max_marks are rejected (422); valid marks are saved and audited', async () => {
    const teacher = await login(USERS.aisha);
    const subs = await api().get(`/api/assignments/${IDS.lab2}/submissions`).set(auth(teacher));
    expect(subs.status).toBe(200);
    const sub = subs.body.data.rows.find((r: { submission: unknown }) => r.submission).submission;
    const tooMany = await api()
      .patch(`/api/submissions/${sub.id}/grade`)
      .set(auth(teacher))
      .send({ marks: 21 });
    expect(tooMany.status).toBe(422);
    const ok = await api()
      .patch(`/api/submissions/${sub.id}/grade`)
      .set(auth(teacher))
      .send({ marks: 18.5, feedback: 'Nice' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.marksObtained).toBe(18.5);
  });

  it('a student can never read another student submission (API and direct Supabase)', async () => {
    const yousuf = await login(USERS.yousuf);
    expect(
      (await api().get(`/api/assignments/${IDS.lab1}/submissions`).set(auth(yousuf))).status,
    ).toBe(403);
    const { data: fatimaSub } = await service
      .from('submissions')
      .select('id')
      .eq('student_id', IDS.fatima)
      .eq('assignment_id', IDS.lab1)
      .single();
    expect(
      (
        await api()
          .patch(`/api/submissions/${fatimaSub!.id}/grade`)
          .set(auth(yousuf))
          .send({ marks: 10 })
      ).status,
    ).toBe(403);

    const direct = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${yousuf}` } },
    });
    const { data } = await direct.from('submissions').select('student_id');
    expect(data!.every((row) => row.student_id === IDS.yousuf)).toBe(true);
  });
});

describe('Feature 5 - Quizzes', () => {
  it('attempt response contains no answer key; score is the sum of fully-correct questions', async () => {
    const student = await login(USERS.salim);
    const start = await api().post(`/api/quizzes/${IDS.quiz2}/attempt`).set(auth(student));
    expect(start.status).toBe(200);
    const raw = JSON.stringify(start.body);
    expect(raw).not.toMatch(/correct/i);
    expect(start.body.data.questions).toHaveLength(4);

    // Correct: q21=b (2 marks), q22=[a,c] (2), wrong: q23 (1), partial multi on none. Expect 4.
    const submit = await api()
      .post(`/api/quizzes/${IDS.quiz2}/attempt/submit`)
      .set(auth(student))
      .send({
        answers: {
          '77777777-7777-4777-8777-777777777721': ['b'],
          '77777777-7777-4777-8777-777777777722': ['c', 'a'],
          '77777777-7777-4777-8777-777777777723': ['true'],
          '77777777-7777-4777-8777-777777777724': ['a'],
        },
      });
    expect(submit.status).toBe(200);
    expect(submit.body.data.score).toBe(4);
    expect(submit.body.data.maxScore).toBe(6);
  });

  it('a second attempt is rejected (409)', async () => {
    const student = await login(USERS.salim);
    const again = await api().post(`/api/quizzes/${IDS.quiz2}/attempt`).set(auth(student));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_ATTEMPTED');
  });

  it('students can never read quiz_answers, even with a direct Supabase call', async () => {
    const student = await login(USERS.fatima);
    const direct = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${student}` } },
    });
    const { data } = await direct.from('quiz_answers').select('*');
    expect(data).toEqual([]);
  });

  it('submission after expiry is rejected and scored 0', async () => {
    const student = await login(USERS.maryam);
    const start = await api().post(`/api/quizzes/${IDS.quiz2}/attempt`).set(auth(student));
    expect(start.status).toBe(200);
    await service
      .from('quiz_attempts')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', start.body.data.attemptId);
    const late = await api()
      .post(`/api/quizzes/${IDS.quiz2}/attempt/submit`)
      .set(auth(student))
      .send({ answers: {} });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('QUIZ_EXPIRED');
    const { data } = await service
      .from('quiz_attempts')
      .select('score, submitted_at')
      .eq('id', start.body.data.attemptId)
      .single();
    expect(Number(data!.score)).toBe(0);
    expect(data!.submitted_at).not.toBeNull();
  });

  it('editing is blocked once an attempt exists, publishing still allowed', async () => {
    const teacher = await login(USERS.aisha);
    const edit = await api()
      .patch(`/api/quizzes/${IDS.quiz1}`)
      .set(auth(teacher))
      .send({ title: 'Renamed' });
    expect(edit.status).toBe(409);
    const publish = await api()
      .patch(`/api/quizzes/${IDS.quiz1}`)
      .set(auth(teacher))
      .send({ isPublished: true });
    expect(publish.status).toBe(200);
  });

  it('teacher builds a quiz; results endpoint is staff-only', async () => {
    const teacher = await login(USERS.aisha);
    const now = Date.now();
    const created = await api()
      .post(`/api/courses/${COURSES.cs101}/quizzes`)
      .set(auth(teacher))
      .send({
        title: 'Builder test',
        timeLimitMinutes: 5,
        opensAt: new Date(now - 60_000).toISOString(),
        closesAt: new Date(now + 3_600_000).toISOString(),
        isPublished: true,
        questions: [
          { type: 'true_false', prompt: 'Sky is blue', correctOptionIds: ['true'] },
          {
            type: 'mcq_multi',
            prompt: 'Primes',
            options: [
              { id: 'a', text: '2' },
              { id: 'b', text: '4' },
              { id: 'c', text: '5' },
            ],
            correctOptionIds: ['a', 'c'],
            marks: 2,
          },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.totalMarks).toBe(3);
    const student = await login(USERS.fatima);
    expect(
      (await api().get(`/api/quizzes/${created.body.data.id}/results`).set(auth(student))).status,
    ).toBe(403);
    expect(
      (await api().get(`/api/quizzes/${created.body.data.id}/results`).set(auth(teacher))).status,
    ).toBe(200);
  });
});

describe('Feature 6 - Announcements', () => {
  it('a student sees global plus own-course announcements only, pinned first', async () => {
    const student = await login(USERS.salim); // CS101 + MATH150, not CS201
    const feed = await api().get('/api/announcements?pageSize=100').set(auth(student));
    expect(feed.status).toBe(200);
    const items = feed.body.data as Array<{ courseId: string | null; isPinned: boolean }>;
    expect(items.some((a) => a.courseId === COURSES.cs201)).toBe(false);
    expect(items.some((a) => a.courseId === null)).toBe(true);
    const firstUnpinned = items.findIndex((a) => !a.isPinned);
    expect(items.slice(firstUnpinned).every((a) => !a.isPinned)).toBe(true);
  });

  it('a teacher cannot post to a course they do not teach or post global', async () => {
    const teacher = await login(USERS.aisha);
    const other = await api()
      .post('/api/announcements')
      .set(auth(teacher))
      .send({ courseId: COURSES.cs201, title: 'x', body: 'y' });
    const global = await api()
      .post('/api/announcements')
      .set(auth(teacher))
      .send({ courseId: null, title: 'x', body: 'y' });
    expect(other.status).toBe(403);
    expect(global.status).toBe(403);
    const own = await api()
      .post('/api/announcements')
      .set(auth(teacher))
      .send({ courseId: COURSES.cs101, title: 'Lab moved', body: 'Room B-110' });
    expect(own.status).toBe(201);
  });

  it('unread count drops to zero after marking read', async () => {
    const student = await login(USERS.yousuf);
    const before = await api().get('/api/announcements/unread-count').set(auth(student));
    expect(before.body.data.count).toBeGreaterThan(0);
    await api().post('/api/announcements/read').set(auth(student)).send({});
    const after = await api().get('/api/announcements/unread-count').set(auth(student));
    expect(after.body.data.count).toBe(0);
  });
});

describe('Feature 7 - Marks', () => {
  it('totals match a manual calculation on seeded data', async () => {
    const student = await login(USERS.yousuf);
    const res = await api().get(`/api/me/marks?courseId=${COURSES.cs101}`).set(auth(student));
    expect(res.status).toBe(200);
    const course = res.body.data.courses[0];
    // Lab 1: 7/10 and Quiz 1: 3/6 -> 10/16 = 62.5%
    expect(course.totals.obtained).toBe(10);
    expect(course.totals.max).toBe(16);
    expect(course.totals.percentage).toBe(62.5);
  });

  it("a student can never request another student's marks (403)", async () => {
    const student = await login(USERS.yousuf);
    expect(
      (await api().get(`/api/me/marks?studentId=${IDS.fatima}`).set(auth(student))).status,
    ).toBe(403);
    expect(
      (await api().get(`/api/courses/${COURSES.cs101}/gradebook`).set(auth(student))).status,
    ).toBe(403);
  });

  it('teacher gradebook CSV has a UTF-8 BOM for Excel', async () => {
    const teacher = await login(USERS.aisha);
    const res = await api()
      .get(`/api/courses/${COURSES.cs101}/gradebook.csv`)
      .set(auth(teacher))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const body = res.body as Buffer;
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body.toString('utf8')).toContain('Fatima Al-Hinai');
    // teacher of another course
    const omar = await login(USERS.omar);
    expect(
      (await api().get(`/api/courses/${COURSES.cs101}/gradebook`).set(auth(omar))).status,
    ).toBe(403);
  });
});

describe('Feature 8 - Classroom chat', () => {
  it('members send and read; HTML is stored and returned as plain text', async () => {
    const student = await login(USERS.fatima);
    const html = '<img src=x onerror=alert(1)>';
    const sent = await api()
      .post(`/api/courses/${COURSES.cs101}/messages`)
      .set(auth(student))
      .send({ body: html });
    expect(sent.status).toBe(201);
    expect(sent.body.data.body).toBe(html);
    const history = await api()
      .get(`/api/courses/${COURSES.cs101}/messages?limit=5`)
      .set(auth(student));
    expect(history.body.data.at(-1).body).toBe(html);
  });

  it('a non-member cannot read, send, or subscribe (RLS)', async () => {
    const salim = await login(USERS.salim); // not in CS201
    expect(
      (await api().get(`/api/courses/${COURSES.cs201}/messages`).set(auth(salim))).status,
    ).toBe(403);
    expect(
      (
        await api()
          .post(`/api/courses/${COURSES.cs201}/messages`)
          .set(auth(salim))
          .send({ body: 'hi' })
      ).status,
    ).toBe(403);
    const direct = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${salim}` } },
    });
    const { data } = await direct.from('chat_messages').select('id').eq('course_id', COURSES.cs201);
    expect(data).toEqual([]);
  });

  it('sender can delete within 5 minutes; others cannot; deleted messages hide their text', async () => {
    const fatima = await login(USERS.fatima);
    const yousuf = await login(USERS.yousuf);
    const sent = await api()
      .post(`/api/courses/${COURSES.cs101}/messages`)
      .set(auth(fatima))
      .send({ body: 'oops' });
    expect(
      (await api().delete(`/api/messages/${sent.body.data.id}`).set(auth(yousuf))).status,
    ).toBe(403);
    const del = await api().delete(`/api/messages/${sent.body.data.id}`).set(auth(fatima));
    expect(del.status).toBe(200);
    expect(del.body.data.body).toBeNull();
    expect(del.body.data.deletedAt).not.toBeNull();
  });
});

describe('Feature 9 - Complaints', () => {
  it('users see only their own complaints; others get 404', async () => {
    const yousuf = await login(USERS.yousuf);
    const mine = await api().get('/api/complaints/mine').set(auth(yousuf));
    expect(mine.status).toBe(200);
    expect(mine.body.data.every((c: { raisedById: string }) => c.raisedById === IDS.yousuf)).toBe(
      true,
    );
    expect(
      (await api().get(`/api/complaints/${IDS.complaintFatima}`).set(auth(yousuf))).status,
    ).toBe(404);
  });

  it('attachments go to the private bucket and are delivered by signed URL', async () => {
    const fatima = await login(USERS.fatima);
    const created = await api()
      .post('/api/complaints')
      .set(auth(fatima))
      .field('category', 'academic')
      .field('subject', 'Quiz timing')
      .field('description', 'The quiz closed earlier than announced in class.')
      .field('courseId', COURSES.cs101)
      .attach('attachment', pdfBuffer(), {
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('open');
    const url = await api()
      .get(`/api/complaints/${created.body.data.id}/attachment`)
      .set(auth(fatima));
    expect(url.status).toBe(200);
    expect(url.body.data.url).toContain('/object/sign/complaint-attachments/');
    const yousuf = await login(USERS.yousuf);
    expect(
      (await api().get(`/api/complaints/${created.body.data.id}/attachment`).set(auth(yousuf)))
        .status,
    ).toBe(404);
  });

  it('resolving without a response is rejected (422); status change notifies the complainant', async () => {
    const admin = await login(USERS.admin);
    const toReview = await api()
      .patch(`/api/admin/complaints/${IDS.complaintFatima}`)
      .set(auth(admin))
      .send({ status: 'in_review' });
    expect(toReview.status).toBe(200);
    const noResponse = await api()
      .patch(`/api/admin/complaints/${IDS.complaintFatima}`)
      .set(auth(admin))
      .send({ status: 'resolved' });
    expect(noResponse.status).toBe(422);
    const resolved = await api()
      .patch(`/api/admin/complaints/${IDS.complaintFatima}`)
      .set(auth(admin))
      .send({ status: 'resolved', adminResponse: 'IT replaced the access point.' });
    expect(resolved.status).toBe(200);

    const fatima = await login(USERS.fatima);
    const unread = await api().get('/api/notifications/unread-count').set(auth(fatima));
    expect(unread.body.data.count).toBeGreaterThan(0);
  });
});

describe('Feature 10 - Password reset', () => {
  it('known and unknown emails get identical responses', async () => {
    const known = await api().post('/api/auth/forgot-password').send({ email: USERS.maryam });
    const unknown = await api()
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@gutech.demo' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('reset works once; a reused link fails; the old password stops working', async () => {
    const { data } = await service.auth.admin.generateLink({
      type: 'recovery',
      email: USERS.salim,
    });
    const verify = await fetch(data.properties!.action_link, { redirect: 'manual' });
    const location = verify.headers.get('location')!;
    const recoveryToken = new URLSearchParams(location.split('#')[1]).get('access_token')!;

    const reset = await api()
      .post('/api/auth/reset-password')
      .set(auth(recoveryToken))
      .send({ newPassword: 'BrandNew2026x' });
    expect(reset.status).toBe(200);
    const reuse = await api()
      .post('/api/auth/reset-password')
      .set(auth(recoveryToken))
      .send({ newPassword: 'Another2026x' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('LINK_INVALID');

    forget(USERS.salim);
    expect(
      (await api().post('/api/auth/login').send({ email: USERS.salim, password: 'Gutech@2026' }))
        .status,
    ).toBe(401);
    expect(
      (await api().post('/api/auth/login').send({ email: USERS.salim, password: 'BrandNew2026x' }))
        .status,
    ).toBe(200);

    // Restore the demo password for later runs.
    await service.auth.admin.updateUserById(IDS.salim, { password: 'Gutech@2026' });
  });

  it('a normal session token cannot be used as a reset link', async () => {
    const token = await login(USERS.omar);
    const res = await api()
      .post('/api/auth/reset-password')
      .set(auth(token))
      .send({ newPassword: 'Whatever2026x' });
    expect(res.status).toBe(400);
  });

  it('change password enforces the policy and verifies the current password', async () => {
    const token = await login(USERS.maryam);
    const weak = await api()
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'Gutech@2026', newPassword: 'short' });
    expect(weak.status).toBe(422);
    const wrong = await api()
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'wrong', newPassword: 'ValidPass2026' });
    expect(wrong.status).toBe(422);
  });
});
