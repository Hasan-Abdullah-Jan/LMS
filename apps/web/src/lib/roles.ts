import type { Role } from './types';

export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  teacher: 'Faculty',
  student: 'Student',
};

export const homeFor = (role: Role | undefined | null): string =>
  role ? ROLE_HOME[role] : '/login';

export const isStaff = (role: Role | undefined | null): boolean =>
  role === 'admin' || role === 'teacher';
