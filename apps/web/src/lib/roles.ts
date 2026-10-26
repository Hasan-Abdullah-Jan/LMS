export type UserRole = 'admin' | 'teacher' | 'student';

export function roleHome(role: UserRole): string {
  return `/${role}`;
}

