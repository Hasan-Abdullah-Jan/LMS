import type { UserRole } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole; accessToken: string; email: string; fullName: string; mustChangePassword: boolean; createdAt: string };
    }
  }
}
export {};

