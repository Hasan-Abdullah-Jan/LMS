import { supabaseAdmin } from '../config/supabase.js';
import { parseEmailList } from '../lib/csv.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import type { Pagination } from '../lib/pagination.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { coursesRepository, type Course, type CourseMember } from '../repositories/courses.repository.js';
import { profilesRepository, type Profile } from '../repositories/profiles.repository.js';
import type { RequestContext } from '../types/auth.js';
import { courseRole, type CourseRole } from './access.service.js';

export interface EnrollmentReport {
  dryRun: boolean;
  enrolled: number;
  matched: Array<{ id: string; email: string; fullName: string }>;
  alreadyEnrolled: string[];
  duplicates: string[];
  unknown: string[];
  invalid: string[];
}

export interface CourseDetail extends Course {
  myRole: CourseRole;
  students?: CourseMember[];
}

async function requireCourse(ctx: RequestContext, id: string): Promise<Course> {
  const course = await coursesRepository.findById(ctx.db, id);
  if (!course) throw notFound('Course');
  return course;
}

export const coursesService = {
  // ---------------------------------------------------------------- admin
  list(ctx: RequestContext, filters: Pagination & { search?: string | undefined; status: 'active' | 'archived' | 'all' }) {
    return coursesRepository.list(ctx.db, {
      ...filters,
      archived: filters.status === 'all' ? undefined : filters.status === 'archived',
    });
  },

  async getForAdmin(ctx: RequestContext, id: string) {
    const course = await requireCourse(ctx, id);
    const students = await coursesRepository.students(ctx.db, id);
    return { ...course, students };
  },

  async create(ctx: RequestContext, input: { code: string; title: string; description?: string | undefined }) {
    const id = await coursesRepository.create(ctx.db, input).catch((err: unknown) => {
      if ((err as { code?: string }).code === 'CONFLICT') throw conflict(`Course code ${input.code} is already in use.`);
      throw err;
    });
    await auditRepository.record(ctx.user.id, 'course.create', 'course', id, { code: input.code });
    return requireCourse(ctx, id);
  },

  async update(
    ctx: RequestContext,
    id: string,
    input: { code?: string | undefined; title?: string | undefined; description?: string | null | undefined; isArchived?: boolean | undefined },
  ) {
    await requireCourse(ctx, id);
    await coursesRepository.update(ctx.db, id, input).catch((err: unknown) => {
      if ((err as { code?: string }).code === 'CONFLICT') throw conflict(`Course code ${input.code} is already in use.`);
      throw err;
    });
    const action = input.isArchived === true ? 'course.archive' : input.isArchived === false ? 'course.restore' : 'course.update';
    await auditRepository.record(ctx.user.id, action, 'course', id, { ...input });
    return requireCourse(ctx, id);
  },

  /** Replace the full teacher set (PUT semantics). */
  async setTeachers(ctx: RequestContext, id: string, teacherIds: string[]) {
    await requireCourse(ctx, id);
    const unique = [...new Set(teacherIds)];
    const profiles = await profilesRepository.findByIds(ctx.db, unique);
    const invalid = unique.filter((tid) => !profiles.some((p) => p.id === tid && p.role === 'teacher' && p.isActive));
    if (invalid.length > 0) {
      throw unprocessable('Only active teachers can be assigned to a course.', [
        { path: 'teacherIds', message: `${invalid.length} selected user(s) are not active teachers.` },
      ]);
    }
    const current = await coursesRepository.teacherIds(ctx.db, id);
    await coursesRepository.removeTeachers(ctx.db, id, current.filter((tid) => !unique.includes(tid)));
    await coursesRepository.addTeachers(ctx.db, id, unique.filter((tid) => !current.includes(tid)));
    await auditRepository.record(ctx.user.id, 'course.set_teachers', 'course', id, { teacherIds: unique });
    return requireCourse(ctx, id);
  },

  /** Enroll by ids or by a CSV of emails. Idempotent; dryRun returns the preview only. */
  async enroll(
    ctx: RequestContext,
    id: string,
    input: { studentIds: string[] } | { csv: string },
    dryRun: boolean,
  ): Promise<EnrollmentReport> {
    await requireCourse(ctx, id);
    const report: EnrollmentReport = {
      dryRun,
      enrolled: 0,
      matched: [],
      alreadyEnrolled: [],
      duplicates: [],
      unknown: [],
      invalid: [],
    };

    let candidates: Profile[];
    if ('csv' in input) {
      const parsed = parseEmailList(input.csv);
      report.duplicates = parsed.duplicates;
      report.invalid = parsed.invalid;
      if (parsed.emails.length === 0 && parsed.invalid.length === 0) {
        throw unprocessable('No email addresses were found in the CSV.');
      }
      const found = await profilesRepository.findByEmails(supabaseAdmin, parsed.emails);
      candidates = found.filter((p) => p.role === 'student' && p.isActive);
      report.unknown = parsed.emails.filter((email) => !candidates.some((p) => p.email === email));
    } else {
      const unique = [...new Set(input.studentIds)];
      const found = await profilesRepository.findByIds(ctx.db, unique);
      candidates = found.filter((p) => p.role === 'student' && p.isActive);
      report.unknown = unique.filter((sid) => !candidates.some((p) => p.id === sid));
      if (candidates.length === 0) {
        throw unprocessable('None of the selected users are active students.');
      }
    }

    const existing = new Set(await coursesRepository.enrolledStudentIds(ctx.db, id));
    const toEnroll = candidates.filter((p) => !existing.has(p.id));
    report.alreadyEnrolled = candidates.filter((p) => existing.has(p.id)).map((p) => p.email);
    report.matched = toEnroll.map((p) => ({ id: p.id, email: p.email, fullName: p.fullName }));

    if (!dryRun && toEnroll.length > 0) {
      await coursesRepository.enroll(ctx.db, id, toEnroll.map((p) => p.id));
      report.enrolled = toEnroll.length;
      await auditRepository.record(ctx.user.id, 'course.enroll', 'course', id, {
        studentIds: toEnroll.map((p) => p.id),
      });
    }
    return report;
  },

  async unenroll(ctx: RequestContext, id: string, studentId: string) {
    await requireCourse(ctx, id);
    const removed = await coursesRepository.unenroll(ctx.db, id, studentId);
    if (!removed) throw notFound('Enrollment');
    await auditRepository.record(ctx.user.id, 'course.unenroll', 'course', id, { studentId });
  },

  // --------------------------------------------------------------- members
  /** "My courses" (students) / "My classes" (teachers). Admins see every active course. */
  async myCourses(ctx: RequestContext): Promise<Course[]> {
    const { role, id } = ctx.user;
    const ids =
      role === 'student'
        ? await coursesRepository.courseIdsForStudent(ctx.db, id)
        : role === 'teacher'
          ? await coursesRepository.courseIdsForTeacher(ctx.db, id)
          : await coursesRepository.allActiveCourseIds(ctx.db);
    return coursesRepository.findByIds(ctx.db, ids);
  },

  async getForMember(ctx: RequestContext, id: string): Promise<CourseDetail> {
    const myRole = await courseRole(ctx, id);
    const course = await requireCourse(ctx, id);
    return { ...course, myRole };
  },

  /** Teachers and classmates (used by chat and pickers). */
  async members(ctx: RequestContext, id: string) {
    const myRole = await courseRole(ctx, id);
    const course = await requireCourse(ctx, id);
    const students = await coursesRepository.students(ctx.db, id);
    const hideContact = myRole === 'student';
    return {
      teachers: course.teachers.map((t) => ({ ...t, rollNo: null })),
      students: students.map((s) => (hideContact ? { ...s, email: '', rollNo: null } : s)),
    };
  },
};
