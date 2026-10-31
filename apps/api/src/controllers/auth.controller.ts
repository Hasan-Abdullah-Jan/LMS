import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../config/env.js';
import { sendData, sendNoContent } from '../lib/http.js';
import { validate } from '../lib/validation.js';
import { ctx, readBearerToken } from '../middleware/auth.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js';
import { authService, type AuthSession } from '../services/auth.service.js';

export const REFRESH_COOKIE = 'gutech_lms_rt';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

/** Access token goes to memory in the SPA; the refresh token only ever lives in an httpOnly cookie. */
function sendSession(res: Response, session: AuthSession) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions());
  sendData(res, {
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    user: session.user,
  });
}

function clearSession(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password } = validate(loginSchema, req.body);
    sendSession(res, await authService.login(email, password));
  },

  async refresh(req: Request, res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== 'string' || !token) {
      // No session cookie: nothing to refresh (not an error for a signed-out visitor).
      clearSession(res);
      sendNoContent(res);
      return;
    }
    try {
      sendSession(res, await authService.refresh(token));
    } catch (err) {
      clearSession(res);
      throw err;
    }
  },

  async logout(req: Request, res: Response) {
    const token = readBearerToken(req);
    if (token) await authService.logout(token);
    clearSession(res);
    sendNoContent(res);
  },

  async me(req: Request, res: Response) {
    sendData(res, await authService.me(ctx(req)));
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = validate(forgotPasswordSchema, req.body);
    sendData(res, await authService.forgotPassword(email));
  },

  async resetPassword(req: Request, res: Response) {
    const { newPassword } = validate(resetPasswordSchema, req.body);
    await authService.resetPassword(readBearerToken(req), newPassword);
    clearSession(res);
    sendData(res, { message: 'Your password has been reset. Sign in with your new password.' });
  },

  async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = validate(changePasswordSchema, req.body);
    const user = await authService.changePassword(ctx(req), currentPassword, newPassword);
    sendData(res, { message: 'Your password has been changed.', user });
  },
};
