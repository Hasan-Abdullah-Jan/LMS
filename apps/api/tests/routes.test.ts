/**
 * Route-level contract tests (no database): for every endpoint, the allowed
 * role reaches the service (happy path) and a disallowed caller is rejected.
 * Services are mocked; their own authorization is covered by the integration
 * acceptance suite (tests/integration).
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const ID = '11111111-1111-4111-8111-111111111111';
const ISO = '2030-01-01T10:00:00.000Z';

const profiles: Record<
  string,
  { role: 'admin' | 'teacher' | 'student'; mustChangePassword?: boolean; isActive?: boolean }
> = {
  admin: { role: 'admin' },
  teacher: { role: 'teacher' },
  student: { role: 'student' },
  temp: { role: 'student', mustChangePassword: true },
  inactive: { role: 'student', isActive: false },
};

vi.mock('../src/config/supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(async (token: string) =>
        token in profiles
          ? { data: { user: { id: token } }, error: null }
          : { data: { user: null }, error: { message: 'bad' } },
      ),
    },
  },
  createUserClient: vi.fn(() => ({})),
  createAnonClient: vi.fn(() => ({})),
}));

vi.mock('../src/repositories/profiles.repository.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/repositories/profiles.repository.js')>();
  return {
    ...actual,
    profilesRepository: {
      ...actual.profilesRepository,
      findById: vi.fn(async (_db: unknown, id: string) => {
        const p = profiles[id];
        return p
          ? {
              id,
              fullName: `${id} user`,
              email: `${id}@gutech.demo`,
              role: p.role,
              rollNo: null,
              isActive: p.isActive ?? true,
              mustChangePassword: p.mustChangePassword ?? false,
              createdAt: ISO,
              updatedAt: ISO,
            }
          : null;
      }),
    },
  };
});

/** Every service method resolves to a generic payload that satisfies the controllers. */
function stubService(overrides: Record<string, unknown> = {}) {
  const generic = {
    rows: [],
    total: 0,
    messages: [],
    hasMore: false,
    fileName: 'gradebook.csv',
    csv: '﻿a',
    count: 0,
  };
  return new Proxy(
    {},
    { get: (_t, key: string) => (key in overrides ? overrides[key] : vi.fn(async () => generic)) },
  );
}

vi.mock('../src/services/auth.service.js', () => ({ authService: stubService() }));
vi.mock('../src/services/users.service.js', () => ({ usersService: stubService() }));
vi.mock('../src/services/courses.service.js', () => ({ coursesService: stubService() }));
vi.mock('../src/services/resources.service.js', () => ({ resourcesService: stubService() }));
vi.mock('../src/services/assignments.service.js', () => ({ assignmentsService: stubService() }));
vi.mock('../src/services/quizzes.service.js', () => ({
  quizzesService: stubService({ list: vi.fn(async () => []) }),
}));
vi.mock('../src/services/marks.service.js', () => ({ marksService: stubService() }));
vi.mock('../src/services/announcements.service.js', () => ({
  announcementsService: stubService(),
}));
vi.mock('../src/services/chat.service.js', () => ({ chatService: stubService() }));
vi.mock('../src/services/complaints.service.js', () => ({ complaintsService: stubService() }));
vi.mock('../src/services/dashboard.service.js', () => ({ dashboardService: stubService() }));
vi.mock('../src/services/notifications.service.js', () => ({
  notificationsService: stubService(),
  auditService: stubService(),
}));

let app: import('express').Express;
beforeAll(async () => {
  app = (await import('../src/app.js')).createApp();
});

type Role = keyof typeof profiles;
interface Case {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: string;
  allowed: Role;
  /** A signed-in role that must get 403, or null when every role is allowed (then: no token -> 401). */
  denied: Role | null;
  body?: Record<string, unknown>;
}

const quiz = {
  title: 'Quiz',
  timeLimitMinutes: 10,
  opensAt: ISO,
  closesAt: '2030-01-02T10:00:00.000Z',
  questions: [{ type: 'true_false', prompt: 'Q?', correctOptionIds: ['true'] }],
};

const cases: Case[] = [
  // Auth (session-only)
  { method: 'get', path: '/api/auth/me', allowed: 'student', denied: null },
  {
    method: 'post',
    path: '/api/auth/change-password',
    allowed: 'temp',
    denied: null,
    body: { currentPassword: 'old', newPassword: 'NewPass2026x' },
  },
  // Admin
  { method: 'get', path: '/api/admin/users', allowed: 'admin', denied: 'teacher' },
  {
    method: 'post',
    path: '/api/admin/users',
    allowed: 'admin',
    denied: 'teacher',
    body: {
      fullName: 'New User',
      email: 'n@gutech.demo',
      role: 'student',
      temporaryPassword: 'Welcome2026x',
    },
  },
  { method: 'get', path: `/api/admin/users/${ID}`, allowed: 'admin', denied: 'student' },
  {
    method: 'patch',
    path: `/api/admin/users/${ID}`,
    allowed: 'admin',
    denied: 'teacher',
    body: { isActive: false },
  },
  {
    method: 'post',
    path: `/api/admin/users/${ID}/reset-password`,
    allowed: 'admin',
    denied: 'teacher',
    body: { mode: 'email' },
  },
  { method: 'get', path: '/api/admin/courses', allowed: 'admin', denied: 'teacher' },
  {
    method: 'post',
    path: '/api/admin/courses',
    allowed: 'admin',
    denied: 'teacher',
    body: { code: 'CS999', title: 'New course' },
  },
  { method: 'get', path: `/api/admin/courses/${ID}`, allowed: 'admin', denied: 'student' },
  {
    method: 'patch',
    path: `/api/admin/courses/${ID}`,
    allowed: 'admin',
    denied: 'teacher',
    body: { isArchived: true },
  },
  {
    method: 'put',
    path: `/api/admin/courses/${ID}/teachers`,
    allowed: 'admin',
    denied: 'teacher',
    body: { teacherIds: [ID] },
  },
  {
    method: 'post',
    path: `/api/admin/courses/${ID}/enrollments`,
    allowed: 'admin',
    denied: 'teacher',
    body: { studentIds: [ID] },
  },
  {
    method: 'delete',
    path: `/api/admin/courses/${ID}/enrollments/${ID}`,
    allowed: 'admin',
    denied: 'teacher',
  },
  { method: 'get', path: '/api/admin/complaints', allowed: 'admin', denied: 'student' },
  {
    method: 'patch',
    path: `/api/admin/complaints/${ID}`,
    allowed: 'admin',
    denied: 'teacher',
    body: { status: 'in_review' },
  },
  { method: 'get', path: '/api/admin/audit-log', allowed: 'admin', denied: 'teacher' },
  // Me
  { method: 'get', path: '/api/me/courses', allowed: 'student', denied: null },
  { method: 'get', path: '/api/me/marks', allowed: 'student', denied: null },
  { method: 'get', path: '/api/me/dashboard', allowed: 'teacher', denied: null },
  // Course-scoped
  { method: 'get', path: `/api/courses/${ID}`, allowed: 'student', denied: null },
  { method: 'get', path: `/api/courses/${ID}/members`, allowed: 'student', denied: null },
  { method: 'get', path: `/api/courses/${ID}/resources`, allowed: 'student', denied: null },
  {
    method: 'post',
    path: `/api/courses/${ID}/resources`,
    allowed: 'teacher',
    denied: 'student',
    body: { title: 'Slides' },
  },
  { method: 'get', path: `/api/courses/${ID}/assignments`, allowed: 'student', denied: null },
  {
    method: 'post',
    path: `/api/courses/${ID}/assignments`,
    allowed: 'teacher',
    denied: 'student',
    body: { title: 'A1', instructions: 'Do it', maxMarks: 10, dueAt: ISO },
  },
  { method: 'get', path: `/api/courses/${ID}/quizzes`, allowed: 'student', denied: null },
  {
    method: 'post',
    path: `/api/courses/${ID}/quizzes`,
    allowed: 'teacher',
    denied: 'student',
    body: quiz,
  },
  { method: 'get', path: `/api/courses/${ID}/messages`, allowed: 'student', denied: null },
  {
    method: 'post',
    path: `/api/courses/${ID}/messages`,
    allowed: 'student',
    denied: 'admin',
    body: { body: 'Hello' },
  },
  { method: 'get', path: `/api/courses/${ID}/gradebook`, allowed: 'teacher', denied: 'student' },
  {
    method: 'get',
    path: `/api/courses/${ID}/gradebook.csv`,
    allowed: 'teacher',
    denied: 'student',
  },
  // Resources
  { method: 'get', path: `/api/resources/${ID}/download`, allowed: 'student', denied: null },
  { method: 'delete', path: `/api/resources/${ID}`, allowed: 'teacher', denied: 'student' },
  // Assignments & submissions
  { method: 'get', path: `/api/assignments/${ID}`, allowed: 'student', denied: null },
  {
    method: 'patch',
    path: `/api/assignments/${ID}`,
    allowed: 'teacher',
    denied: 'student',
    body: { title: 'Renamed' },
  },
  { method: 'delete', path: `/api/assignments/${ID}`, allowed: 'teacher', denied: 'student' },
  { method: 'get', path: `/api/assignments/${ID}/attachment`, allowed: 'student', denied: null },
  {
    method: 'put',
    path: `/api/assignments/${ID}/submission`,
    allowed: 'student',
    denied: 'teacher',
    body: { textAnswer: 'My answer' },
  },
  {
    method: 'get',
    path: `/api/assignments/${ID}/submissions`,
    allowed: 'teacher',
    denied: 'student',
  },
  {
    method: 'patch',
    path: `/api/submissions/${ID}/grade`,
    allowed: 'teacher',
    denied: 'student',
    body: { marks: 8 },
  },
  { method: 'get', path: `/api/submissions/${ID}/file`, allowed: 'student', denied: null },
  // Quizzes
  { method: 'get', path: `/api/quizzes/${ID}`, allowed: 'student', denied: null },
  {
    method: 'patch',
    path: `/api/quizzes/${ID}`,
    allowed: 'teacher',
    denied: 'student',
    body: { isPublished: true },
  },
  { method: 'delete', path: `/api/quizzes/${ID}`, allowed: 'teacher', denied: 'student' },
  { method: 'post', path: `/api/quizzes/${ID}/attempt`, allowed: 'student', denied: 'teacher' },
  {
    method: 'post',
    path: `/api/quizzes/${ID}/attempt/submit`,
    allowed: 'student',
    denied: 'teacher',
    body: { answers: { [ID]: ['a'] } },
  },
  { method: 'get', path: `/api/quizzes/${ID}/results`, allowed: 'teacher', denied: 'student' },
  // Announcements
  { method: 'get', path: '/api/announcements', allowed: 'student', denied: null },
  {
    method: 'post',
    path: '/api/announcements',
    allowed: 'teacher',
    denied: 'student',
    body: { courseId: ID, title: 'Hi', body: 'There' },
  },
  { method: 'get', path: '/api/announcements/unread-count', allowed: 'student', denied: null },
  { method: 'post', path: '/api/announcements/read', allowed: 'student', denied: null, body: {} },
  {
    method: 'patch',
    path: `/api/announcements/${ID}`,
    allowed: 'teacher',
    denied: 'student',
    body: { isPinned: true },
  },
  { method: 'delete', path: `/api/announcements/${ID}`, allowed: 'admin', denied: 'student' },
  // Chat
  { method: 'delete', path: `/api/messages/${ID}`, allowed: 'student', denied: null },
  // Complaints
  {
    method: 'post',
    path: '/api/complaints',
    allowed: 'student',
    denied: 'admin',
    body: { category: 'technical', subject: 'Wi-Fi', description: 'Wi-Fi keeps dropping.' },
  },
  { method: 'get', path: '/api/complaints/mine', allowed: 'teacher', denied: 'admin' },
  { method: 'get', path: `/api/complaints/${ID}`, allowed: 'student', denied: null },
  {
    method: 'post',
    path: `/api/complaints/${ID}/follow-up`,
    allowed: 'student',
    denied: 'admin',
    body: { comment: 'Any update?' },
  },
  { method: 'get', path: `/api/complaints/${ID}/attachment`, allowed: 'admin', denied: null },
  // Notifications
  { method: 'get', path: '/api/notifications', allowed: 'student', denied: null },
  { method: 'get', path: '/api/notifications/unread-count', allowed: 'student', denied: null },
  { method: 'post', path: '/api/notifications/read-all', allowed: 'student', denied: null },
];

describe.each(cases)('$method $path', ({ method, path, allowed, denied, body }) => {
  it(`allows ${allowed}`, async () => {
    const res = await request(app)
      [method](path)
      .set('Authorization', `Bearer ${allowed}`)
      .send(body);
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  });

  if (denied) {
    it(`rejects ${denied} with 403`, async () => {
      const res = await request(app)
        [method](path)
        .set('Authorization', `Bearer ${denied}`)
        .send(body);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  } else {
    it('rejects anonymous callers with 401', async () => {
      const res = await request(app)[method](path).send(body);
      expect(res.status).toBe(401);
    });
  }
});

describe('cross-cutting behaviour', () => {
  it('health is public', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('there is no sign-up endpoint (404)', async () => {
    expect((await request(app).post('/api/signup')).status).toBe(404);
    expect((await request(app).post('/api/auth/signup')).status).toBe(404);
  });

  it('a temporary password blocks everything except auth endpoints', async () => {
    const res = await request(app).get('/api/me/courses').set('Authorization', 'Bearer temp');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('a deactivated account is rejected even with a valid token', async () => {
    const res = await request(app).get('/api/me/courses').set('Authorization', 'Bearer inactive');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('invalid bodies are rejected with 422 and field details', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', 'Bearer admin')
      .send({ email: 'bad' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('malformed JSON is a 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
  });

  it('page size above 100 is rejected', async () => {
    const res = await request(app)
      .get('/api/admin/users?pageSize=500')
      .set('Authorization', 'Bearer admin');
    expect(res.status).toBe(422);
  });

  it('marks above zero decimals / negative are rejected', async () => {
    const res = await request(app)
      .patch(`/api/submissions/${ID}/grade`)
      .set('Authorization', 'Bearer teacher')
      .send({ marks: -1 });
    expect(res.status).toBe(422);
  });
});
