import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { adminClient, userClient } from '../../config/supabase.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole, publicProfile } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/errors.js';
import { adminReset, changePassword, createAccount, listAccounts, login, refresh, resetPassword, sendReset, updateAccount } from './auth.service.js';
import { changePasswordSchema, createUserSchema, forgotSchema, loginSchema, patchUserSchema, resetSchema, userListSchema } from './auth.schemas.js';

const router = Router();
const validateBody = <T extends z.ZodTypeAny>(schema: T) => (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'VALIDATION_ERROR', 'Request validation failed'));
  req.body = result.data;
  next();
};
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/auth' };
const getRefreshCookie = (req: import('express').Request) => {
  const raw = req.headers.cookie?.split(';').map((x) => x.trim()).find((x) => x.startsWith('lms_refresh='));
  return raw?.slice('lms_refresh='.length);
};
const setSession = (res: import('express').Response, session: Awaited<ReturnType<typeof login>>) => {
  res.cookie('lms_refresh', session.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ data: { accessToken: session.accessToken, profile: publicProfile(session.profile) } });
};
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: (req) => `${req.ip ?? 'unknown'}:${String(req.body?.email ?? '').toLowerCase()}`,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } },
});
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: (req) => `forgot:${String(req.body?.email ?? '').toLowerCase()}`,
  message: { data: { message: 'If an account exists for that email, a reset link has been sent.' } },
});

router.post('/login', validateBody(loginSchema), loginLimiter, asyncHandler(async (req, res) => {
  const session = await login(req.body.email, req.body.password);
  setSession(res, session);
}));
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = getRefreshCookie(req);
  if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Session expired');
  const session = await refresh(token);
  setSession(res, session);
}));
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await userClient(req.user!.accessToken).auth.signOut({ scope: 'global' });
  res.clearCookie('lms_refresh', cookieOptions);
  res.json({ data: { success: true } });
}));
router.get('/me', requireAuth, (req, res) => res.json({ data: publicProfile({
  id: req.user!.id, full_name: req.user!.fullName, email: req.user!.email, role: req.user!.role,
  is_active: true, must_change_password: req.user!.mustChangePassword, created_at: req.user!.createdAt,
}) }));
router.post('/forgot-password', validateBody(forgotSchema), forgotLimiter, asyncHandler(async (req, res) => {
  await sendReset(req.body.email);
  res.json({ data: { message: 'If an account exists for that email, a reset link has been sent.' } });
}));
router.post('/reset-password', validateBody(resetSchema), asyncHandler(async (req, res) => {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Reset link is invalid or expired');
  await resetPassword(token, req.body.newPassword);
  res.clearCookie('lms_refresh', cookieOptions);
  res.json({ data: { success: true } });
}));
router.post('/change-password', requireAuth, validateBody(changePasswordSchema), asyncHandler(async (req, res) => {
  await changePassword(req.user!.accessToken, req.user!.email, req.body.currentPassword, req.body.newPassword);
  res.json({ data: { success: true } });
}));

router.post('/admin/users', requireAuth, requireRole('admin'), validateBody(createUserSchema), asyncHandler(async (req, res) => {
  const profile = await createAccount(req.user!.id, req.body);
  res.status(201).json({ data: publicProfile(profile) });
}));
router.get('/admin/users', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const query = userListSchema.safeParse(req.query);
  if (!query.success) throw new HttpError(422, 'VALIDATION_ERROR', 'Request validation failed');
  const result = await listAccounts(query.data);
  res.json({ data: result.data.map(publicProfile), meta: result.meta });
}));
router.patch('/admin/users/:id', requireAuth, requireRole('admin'), validateBody(patchUserSchema), asyncHandler(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  const profile = await updateAccount(id.data, req.user!.id, req.body);
  res.json({ data: publicProfile(profile) });
}));
router.post('/admin/users/:id/reset-password', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  const admin = adminClient();
  const { data, error } = await admin.from('profiles').select('email').eq('id', id.data).maybeSingle();
  if (error || !data) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  await adminReset(data.email);
  res.json({ data: { success: true } });
}));

export default router;

