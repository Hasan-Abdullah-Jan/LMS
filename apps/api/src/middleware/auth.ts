import type { NextFunction, Request, Response } from 'express';
import { createUserClient, supabaseAdmin } from '../config/supabase.js';
import { AppError, forbidden, unauthorized } from '../lib/errors.js';
import { profilesRepository } from '../repositories/profiles.repository.js';
import type { RequestContext, Role } from '../types/auth.js';

export function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Verify the Supabase JWT (including revocation, via Auth), load the profile,
 * reject deactivated accounts, and attach req.user / req.db.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) throw unauthorized();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw unauthorized('Your session has expired. Please sign in again.');

  const profile = await profilesRepository.findById(supabaseAdmin, data.user.id);
  if (!profile) throw unauthorized('Your account is not set up. Contact the administrator.');
  if (!profile.isActive) {
    throw new AppError(
      401,
      'ACCOUNT_DEACTIVATED',
      'Your account has been deactivated. Contact the administrator.',
    );
  }

  req.user = {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    mustChangePassword: profile.mustChangePassword,
  };
  req.accessToken = token;
  req.db = createUserClient(token);
  next();
}

/** Allow only the given roles (403 otherwise). Use after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Block everything except auth endpoints until a temporary password is changed. */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'You must change your temporary password before continuing.',
    );
  }
  next();
}

/** Typed access to the authenticated context inside controllers. */
export function ctx(req: Request): RequestContext {
  if (!req.user || !req.db || !req.accessToken) throw unauthorized();
  return { user: req.user, db: req.db, accessToken: req.accessToken };
}
