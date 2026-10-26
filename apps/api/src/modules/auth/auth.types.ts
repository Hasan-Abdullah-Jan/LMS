export type UserRole = 'admin' | 'teacher' | 'student';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

