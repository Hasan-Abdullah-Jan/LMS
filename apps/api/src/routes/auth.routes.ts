import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { forgotPasswordLimiter, loginLimiter } from '../middleware/rate-limits.js';

/** Authentication. Note: there is deliberately NO sign-up route. */
export const authRoutes = Router()
  .post('/login', loginLimiter, authController.login)
  .post('/refresh', authController.refresh)
  .post('/logout', authController.logout)
  .post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword)
  .post('/reset-password', authController.resetPassword)
  .get('/me', requireAuth, authController.me)
  .post('/change-password', requireAuth, authController.changePassword);
