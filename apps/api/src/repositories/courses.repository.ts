import type { Db } from '../config/supabase.js';
import { unwrap, unwrapList, unwrapRequired } from '../lib/db.js';
import { toRange, type Pagination } from '../lib/pagination.js';
import { escapeLike } from './profiles.repository.js';
import { toPersonSummary, type PersonSummary, type Row } from './mappers.js';

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  teachers: PersonSummary[];
  studentCount: number;
}

export interface CourseMember extends PersonSummary {
  rollNo: string | null;
  enrolledAt?: string;
}

type ProfileLite = Pick<Row<'profiles'>, 'id' | 'full_name' | 'email' | 'role'>;
type CourseRow = Row<'courses'> & {
  course_teachers: Array<{ teacher: ProfileLite | null }>;
  enrollments: Array<{ count: number }>;
};

const COURSE_SELECT =
  '*, course_teachers(teacher:profiles(id, full_name, email, role)), enrollments(count)';

function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    teachers: row.course_teachers
      .map((link) => link.teacher)
      .filter((teacher): teacher is ProfileLite => Boolean(teacher))
      .map(toPersonSummary)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    studentCount: row.enrollments[0]?.count ?? 0,
  };
}

export interface CourseFilters extends Pagination {
  search?: string | undefined;
  archived?: boolean | undefined;
}

export interface CourseInput {
  code?: string | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
  isArchived?: boolean | undefined;
}

export const coursesRepository = {
  async list(db: Db, filters: CourseFilters): Promise<{ rows: Course[]; total: number }> {
    const [from, to] = toRange(filters);
    let query = db
      .from('courses')
      .select(COURSE_SELECT, { count: 'exact' })
      .order('is_archived')
      .order('code')
      .range(from, to);
    if (filters.archived !== undefined) query = query.eq('is_archived', filters.archived);
    if (filters.search) {
      const term = escapeLike(filters.search);
      query = query.or(`code.ilike.%${term}%,title.ilike.%${term}%`);
    }
    const result = await query;
    const rows = unwrapList(result, 'Course') as unknown as CourseRow[];
    return { rows: rows.map(toCourse), total: result.count ?? rows.length };
  },

  async findById(db: Db, id: string): Promise<Course | null> {
    const row = unwrap(
      await db.from('courses').select(COURSE_SELECT).eq('id', id).maybeSingle(),
      'Course',
    );
    return row ? toCourse(row as unknown as CourseRow) : null;
  },

  async findByIds(db: Db, ids: string[], includeArchived = false): Promise<Course[]> {
    if (ids.length === 0) return [];
    let query = db.from('courses').select(COURSE_SELECT).in('id', ids).order('code');
    if (!includeArchived) query = query.eq('is_archived', false);
    const rows = unwrapList(await query, 'Course') as unknown as CourseRow[];
    return rows.map(toCourse);
  },

  async create(
    db: Db,
    input: Required<Pick<CourseInput, 'code' | 'title'>> & CourseInput,
  ): Promise<string> {
    const row = unwrapRequired(
      await db
        .from('courses')
        .insert({ code: input.code, title: input.title, description: input.description ?? null })
        .select('id')
        .single(),
      'Course',
    );
    return row.id;
  },

  async update(db: Db, id: string, input: CourseInput): Promise<void> {
    unwrapRequired(
      await db
        .from('courses')
        .update({
          ...(input.code !== undefined && { code: input.code }),
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.isArchived !== undefined && { is_archived: input.isArchived }),
        })
        .eq('id', id)
        .select('id')
        .maybeSingle(),
      'Course',
    );
  },

  async teacherIds(db: Db, courseId: string): Promise<string[]> {
    const rows = unwrapList(
      await db.from('course_teachers').select('teacher_id').eq('course_id', courseId),
      'Course',
    );
    return rows.map((row) => row.teacher_id);
  },

  async addTeachers(db: Db, courseId: string, teacherIds: string[]): Promise<void> {
    if (teacherIds.length === 0) return;
    unwrap(
      await db.from('course_teachers').upsert(
        teacherIds.map((teacher_id) => ({ course_id: courseId, teacher_id })),
        { onConflict: 'course_id,teacher_id', ignoreDuplicates: true },
      ),
      'Course teacher',
    );
  },

  async removeTeachers(db: Db, courseId: string, teacherIds: string[]): Promise<void> {
    if (teacherIds.length === 0) return;
    unwrap(
      await db
        .from('course_teachers')
        .delete()
        .eq('course_id', courseId)
        .in('teacher_id', teacherIds),
      'Course teacher',
    );
  },

  async enrolledStudentIds(db: Db, courseId: string): Promise<string[]> {
    const rows = unwrapList(
      await db.from('enrollments').select('student_id').eq('course_id', courseId),
      'Enrollment',
    );
    return rows.map((row) => row.student_id);
  },

  /** Idempotent: existing enrollments are ignored, never duplicated. */
  async enroll(db: Db, courseId: string, studentIds: string[]): Promise<void> {
    if (studentIds.length === 0) return;
    unwrap(
      await db.from('enrollments').upsert(
        studentIds.map((student_id) => ({ course_id: courseId, student_id })),
        { onConflict: 'course_id,student_id', ignoreDuplicates: true },
      ),
      'Enrollment',
    );
  },

  async unenroll(db: Db, courseId: string, studentId: string): Promise<boolean> {
    const rows = unwrapList(
      await db
        .from('enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('student_id', studentId)
        .select('student_id'),
      'Enrollment',
    );
    return rows.length > 0;
  },

  async students(db: Db, courseId: string): Promise<CourseMember[]> {
    const rows = unwrapList(
      await db
        .from('enrollments')
        .select('enrolled_at, student:profiles(id, full_name, email, role, roll_no)')
        .eq('course_id', courseId),
      'Enrollment',
    );
    return rows
      .filter((row) => row.student)
      .map((row) => ({
        ...toPersonSummary(row.student!),
        rollNo: row.student!.roll_no,
        enrolledAt: row.enrolled_at,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async courseIdsForTeacher(db: Db, teacherId: string): Promise<string[]> {
    const rows = unwrapList(
      await db.from('course_teachers').select('course_id').eq('teacher_id', teacherId),
      'Course',
    );
    return rows.map((row) => row.course_id);
  },

  async courseIdsForStudent(db: Db, studentId: string): Promise<string[]> {
    const rows = unwrapList(
      await db.from('enrollments').select('course_id').eq('student_id', studentId),
      'Course',
    );
    return rows.map((row) => row.course_id);
  },

  async allActiveCourseIds(db: Db): Promise<string[]> {
    const rows = unwrapList(
      await db.from('courses').select('id').eq('is_archived', false).limit(500),
      'Course',
    );
    return rows.map((row) => row.id);
  },

  async count(db: Db): Promise<{ active: number; archived: number }> {
    const [active, archived] = await Promise.all([
      db.from('courses').select('id', { count: 'exact', head: true }).eq('is_archived', false),
      db.from('courses').select('id', { count: 'exact', head: true }).eq('is_archived', true),
    ]);
    unwrap(active, 'Course');
    unwrap(archived, 'Course');
    return { active: active.count ?? 0, archived: archived.count ?? 0 };
  },
};
