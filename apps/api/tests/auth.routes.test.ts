import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  role: 'admin' as 'admin' | 'teacher' | 'student',
  signOut: vi.fn(async () => ({ error: null })),
}));
vi.mock('../src/config/supabase.js', () => ({
  userClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: '10000000-0000-4000-8000-000000000001' } }, error: null }),
      signOut: mocks.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
      id: '10000000-0000-4000-8000-000000000001', full_name: 'Alex Morgan', email: 'admin@example.com',
      role: mocks.role, is_active: true, must_change_password: false, created_at: '2026-01-01T00:00:00Z',
    }, error: null }) }) }) }),
  }),
  adminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: 'person@example.com' }, error: null }) }) }) }) }),
}));
vi.mock('../src/modules/auth/auth.service.js', () => ({
  login: vi.fn(async () => ({ accessToken: 'access', refreshToken: 'refresh', profile: {
    id: '10000000-0000-4000-8000-000000000001', full_name: 'Alex Morgan', email: 'admin@example.com',
    role: 'admin', is_active: true, must_change_password: false, created_at: '2026-01-01T00:00:00Z',
  } })),
  refresh: vi.fn(async () => ({ accessToken: 'access', refreshToken: 'refresh', profile: {
    id: '10000000-0000-4000-8000-000000000001', full_name: 'Alex Morgan', email: 'admin@example.com',
    role: 'admin', is_active: true, must_change_password: false, created_at: '2026-01-01T00:00:00Z',
  } })),
  createAccount: vi.fn(async () => ({ id: '10000000-0000-4000-8000-000000000002', full_name: 'Taylor Reed', email: 'taylor@example.com', role: 'student', is_active: true, must_change_password: true, created_at: '2026-01-01T00:00:00Z' })),
  listAccounts: vi.fn(async (q: { page: number; pageSize: number }) => ({ data: [], meta: { page: q.page, pageSize: q.pageSize, total: 0 } })),
  updateAccount: vi.fn(async () => ({ id: '10000000-0000-4000-8000-000000000002', full_name: 'Taylor Reed', email: 'taylor@example.com', role: 'student', is_active: true, must_change_password: false, created_at: '2026-01-01T00:00:00Z' })),
  sendReset: vi.fn(async () => undefined),
  resetPassword: vi.fn(async () => undefined),
  changePassword: vi.fn(async () => undefined),
  adminReset: vi.fn(async () => undefined),
}));
import { app } from '../src/app.js';

const bearer = { Authorization: 'Bearer test-token' };
const validPassword = 'Newpass1234';

describe('Feature 1 auth routes', () => {
  beforeEach(() => { mocks.role = 'admin'; vi.clearAllMocks(); });

  it('POST /auth/login returns a session', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'secret' });
    expect(r.status).toBe(200); expect(r.body.data.accessToken).toBe('access'); expect(r.headers['set-cookie'][0]).toContain('lms_refresh=refresh');
  });
  it('POST /auth/login validates the body', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'bad', password: '' });
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('POST /auth/refresh exchanges the refresh cookie', async () => {
    const r = await request(app).post('/api/auth/refresh').set('Cookie', 'lms_refresh=old-refresh');
    expect(r.status).toBe(200); expect(r.body.data.accessToken).toBe('access');
  });
  it('POST /auth/refresh rejects a missing cookie', async () => {
    const r = await request(app).post('/api/auth/refresh');
    expect(r.status).toBe(401);
  });
  it('POST /auth/logout invalidates an authenticated session', async () => {
    const r = await request(app).post('/api/auth/logout').set(bearer);
    expect(r.status).toBe(200); expect(r.body.data.success).toBe(true);
  });
  it('POST /auth/logout rejects an unauthenticated caller', async () => {
    const r = await request(app).post('/api/auth/logout');
    expect(r.status).toBe(401);
  });
  it('GET /auth/me returns the current profile', async () => {
    const r = await request(app).get('/api/auth/me').set(bearer);
    expect(r.status).toBe(200); expect(r.body.data.role).toBe('admin');
  });
  it('GET /auth/me requires authentication', async () => {
    const r = await request(app).get('/api/auth/me');
    expect(r.status).toBe(401);
  });
  it('POST /auth/forgot-password returns the neutral confirmation', async () => {
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.com' });
    expect(r.status).toBe(200); expect(r.body.data.message).toContain('If an account exists');
  });
  it('POST /auth/forgot-password validates the email', async () => {
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'invalid' });
    expect(r.status).toBe(422);
  });
  it('POST /auth/reset-password accepts a valid recovery token', async () => {
    const r = await request(app).post('/api/auth/reset-password').set(bearer).send({ newPassword: validPassword });
    expect(r.status).toBe(200);
  });
  it('POST /auth/reset-password requires a recovery token', async () => {
    const r = await request(app).post('/api/auth/reset-password').send({ newPassword: validPassword });
    expect(r.status).toBe(401);
  });
  it('POST /auth/change-password updates an authenticated account', async () => {
    const r = await request(app).post('/api/auth/change-password').set(bearer).send({ currentPassword: 'old', newPassword: validPassword });
    expect(r.status).toBe(200);
  });
  it('POST /auth/change-password requires authentication', async () => {
    const r = await request(app).post('/api/auth/change-password').send({ currentPassword: 'old', newPassword: validPassword });
    expect(r.status).toBe(401);
  });
  it('POST /admin/users creates an account for an admin', async () => {
    const r = await request(app).post('/api/auth/admin/users').set(bearer).send({ fullName: 'Taylor Reed', email: 'taylor@example.com', role: 'student', temporaryPassword: validPassword, rollNo: 'NS-77' });
    expect(r.status).toBe(201); expect(r.body.data.mustChangePassword).toBe(true);
  });
  it('POST /admin/users denies a teacher', async () => {
    mocks.role = 'teacher';
    const r = await request(app).post('/api/auth/admin/users').set(bearer).send({ fullName: 'Taylor Reed', email: 'taylor@example.com', role: 'student', temporaryPassword: validPassword, rollNo: 'NS-77' });
    expect(r.status).toBe(403);
  });
  it('GET /admin/users returns paginated data to an admin', async () => {
    const r = await request(app).get('/api/auth/admin/users?page=1&pageSize=10').set(bearer);
    expect(r.status).toBe(200); expect(r.body.meta).toEqual({ page: 1, pageSize: 10, total: 0 });
  });
  it('GET /admin/users denies a student', async () => {
    mocks.role = 'student';
    const r = await request(app).get('/api/auth/admin/users').set(bearer);
    expect(r.status).toBe(403);
  });
  it('PATCH /admin/users/:id updates an account', async () => {
    const r = await request(app).patch('/api/auth/admin/users/10000000-0000-4000-8000-000000000002').set(bearer).send({ isActive: false });
    expect(r.status).toBe(200);
  });
  it('PATCH /admin/users/:id denies a teacher', async () => {
    mocks.role = 'teacher';
    const r = await request(app).patch('/api/auth/admin/users/10000000-0000-4000-8000-000000000002').set(bearer).send({ isActive: false });
    expect(r.status).toBe(403);
  });
  it('POST /admin/users/:id/reset-password sends an admin-triggered reset', async () => {
    const r = await request(app).post('/api/auth/admin/users/10000000-0000-4000-8000-000000000002/reset-password').set(bearer);
    expect(r.status).toBe(200);
  });
  it('POST /admin/users/:id/reset-password denies a student', async () => {
    mocks.role = 'student';
    const r = await request(app).post('/api/auth/admin/users/10000000-0000-4000-8000-000000000002/reset-password').set(bearer);
    expect(r.status).toBe(403);
  });
});

