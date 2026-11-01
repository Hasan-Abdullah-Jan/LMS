import { Router } from 'express';
import { checkReadiness } from '../services/health.service.js';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';
import { adminRoutes } from './admin.routes.js';
import { appRoutes } from './app.routes.js';
import { authRoutes } from './auth.routes.js';

/** Prefixes that require a signed-in user. Anything else under /api is a 404 (e.g. /api/signup). */
const PROTECTED_PREFIXES = [
  '/me',
  '/courses',
  '/resources',
  '/assignments',
  '/submissions',
  '/quizzes',
  '/announcements',
  '/messages',
  '/complaints',
  '/notifications',
];

export const apiRouter = Router()
  .get('/health', (_req, res) => {
    res.json({ data: { status: 'ok', service: 'gutech-lms-api', time: new Date().toISOString() } });
  })
  .get('/health/ready', async (_req, res) => {
    res.json({ data: await checkReadiness() });
  })
  .use('/auth', authRoutes)
  .use('/admin', requireAuth, requirePasswordChanged, adminRoutes)
  .use(PROTECTED_PREFIXES, requireAuth, requirePasswordChanged)
  .use(appRoutes);
