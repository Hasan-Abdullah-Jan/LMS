import type { RequestHandler } from 'express';
import { userClient } from '../config/supabase.js';
import { asyncHandler } from './async-handler.js';
import { HttpError } from './errors.js';
import type { Profile, UserRole } from '../modules/auth/auth.types.js';

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  const client = userClient(token);
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  const { data: profile, error } = await client.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  if (error || !profile || !profile.is_active) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  req.user = {
    id: profile.id,
    role: profile.role as UserRole,
    accessToken: token,
    email: profile.email,
    fullName: profile.full_name,
    mustChangePassword: profile.must_change_password,
    createdAt: profile.created_at,
  };
  next();
});

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to do this'));
    next();
  };
}

export function getProfile(client: ReturnType<typeof userClient>, id: string) {
  return client.from('profiles').select('id,full_name,email,role,is_active,must_change_password,created_at').eq('id', id).maybeSingle();
}

export function publicProfile(profile: Profile) {
  return {
    id: profile.id, fullName: profile.full_name, email: profile.email, role: profile.role,
    isActive: profile.is_active, mustChangePassword: profile.must_change_password, createdAt: profile.created_at,
  };
}

