export type Role = 'admin' | 'teacher' | 'student';
export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}
export interface SessionData { accessToken: string; profile: Profile }

