import type { Db } from '../config/supabase.js';
import { unwrap, unwrapList, unwrapRequired } from '../lib/db.js';
import { toRange, type Pagination } from '../lib/pagination.js';
import type { Role } from '../types/auth.js';
import type { Row } from './mappers.js';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  rollNo: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toProfile(row: Row<'profiles'>): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    rollNo: row.roll_no,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProfileFilters extends Pagination {
  search?: string | undefined;
  role?: Role | undefined;
  isActive?: boolean | undefined;
}

export interface NewProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  rollNo: string | null;
  mustChangePassword: boolean;
}

export interface ProfilePatch {
  fullName?: string | undefined;
  role?: Role | undefined;
  rollNo?: string | null | undefined;
  isActive?: boolean | undefined;
  mustChangePassword?: boolean | undefined;
}

function toRowPatch(patch: ProfilePatch) {
  return {
    ...(patch.fullName !== undefined && { full_name: patch.fullName }),
    ...(patch.role !== undefined && { role: patch.role }),
    ...(patch.rollNo !== undefined && { roll_no: patch.rollNo }),
    ...(patch.isActive !== undefined && { is_active: patch.isActive }),
    ...(patch.mustChangePassword !== undefined && { must_change_password: patch.mustChangePassword }),
  };
}

/** Escape characters with special meaning in PostgREST filter strings. */
export function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, (char) => `\\${char}`).replace(/[,()]/g, ' ');
}

export const profilesRepository = {
  async findById(db: Db, id: string): Promise<Profile | null> {
    const row = unwrap(await db.from('profiles').select('*').eq('id', id).maybeSingle(), 'User');
    return row ? toProfile(row) : null;
  },

  async findByEmail(db: Db, email: string): Promise<Profile | null> {
    const row = unwrap(
      await db.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle(),
      'User',
    );
    return row ? toProfile(row) : null;
  },

  async findByIds(db: Db, ids: string[]): Promise<Profile[]> {
    if (ids.length === 0) return [];
    const rows = unwrapList(await db.from('profiles').select('*').in('id', ids), 'User');
    return rows.map(toProfile);
  },

  async findByEmails(db: Db, emails: string[]): Promise<Profile[]> {
    if (emails.length === 0) return [];
    const rows = unwrapList(await db.from('profiles').select('*').in('email', emails), 'User');
    return rows.map(toProfile);
  },

  async list(db: Db, filters: ProfileFilters): Promise<{ rows: Profile[]; total: number }> {
    const [from, to] = toRange(filters);
    let query = db
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('role')
      .order('full_name')
      .range(from, to);
    if (filters.role) query = query.eq('role', filters.role);
    if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);
    if (filters.search) {
      const term = escapeLike(filters.search);
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,roll_no.ilike.%${term}%`);
    }
    const result = await query;
    const rows = unwrapList(result, 'User');
    return { rows: rows.map(toProfile), total: result.count ?? rows.length };
  },

  async insert(db: Db, profile: NewProfile): Promise<Profile> {
    const row = unwrapRequired(
      await db
        .from('profiles')
        .insert({
          id: profile.id,
          full_name: profile.fullName,
          email: profile.email.toLowerCase(),
          role: profile.role,
          roll_no: profile.rollNo,
          must_change_password: profile.mustChangePassword,
        })
        .select('*')
        .single(),
      'User',
    );
    return toProfile(row);
  },

  async update(db: Db, id: string, patch: ProfilePatch): Promise<Profile> {
    const row = unwrapRequired(
      await db.from('profiles').update(toRowPatch(patch)).eq('id', id).select('*').maybeSingle(),
      'User',
    );
    return toProfile(row);
  },

  async countByRole(db: Db): Promise<Record<Role, number>> {
    const counts: Record<Role, number> = { admin: 0, teacher: 0, student: 0 };
    await Promise.all(
      (Object.keys(counts) as Role[]).map(async (role) => {
        const result = await db
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', role)
          .eq('is_active', true);
        unwrap(result, 'User');
        counts[role] = result.count ?? 0;
      }),
    );
    return counts;
  },
};

/** How many course links (teaching + enrollments) a user has. Used to guard role changes. */
export async function countCourseLinks(db: Db, userId: string): Promise<number> {
  const [teaching, enrolled] = await Promise.all([
    db.from('course_teachers').select('course_id', { count: 'exact', head: true }).eq('teacher_id', userId),
    db.from('enrollments').select('course_id', { count: 'exact', head: true }).eq('student_id', userId),
  ]);
  unwrap(teaching, 'Course');
  unwrap(enrolled, 'Course');
  return (teaching.count ?? 0) + (enrolled.count ?? 0);
}
