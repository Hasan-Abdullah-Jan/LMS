import { supabaseAdmin } from '../config/supabase.js';
import { toCsv } from '../lib/csv.js';
import { forbidden } from '../lib/errors.js';
import { assignmentsRepository } from '../repositories/assignments.repository.js';
import { coursesRepository } from '../repositories/courses.repository.js';
import { marksRepository, type MarkItem } from '../repositories/marks.repository.js';
import { quizzesRepository } from '../repositories/quizzes.repository.js';
import type { RequestContext } from '../types/auth.js';
import { assertCourseStaff, courseRole } from './access.service.js';

export interface Totals {
  obtained: number;
  max: number;
  /** null when nothing has been graded yet. */
  percentage: number | null;
  gradedCount: number;
  pendingCount: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** percentage = sum(obtained) / sum(max) * 100 over graded items only. */
export function computeTotals(items: Array<Pick<MarkItem, 'obtained' | 'max'>>): Totals {
  const graded = items.filter((item) => item.obtained !== null);
  const obtained = round2(graded.reduce((sum, item) => sum + (item.obtained ?? 0), 0));
  const max = round2(graded.reduce((sum, item) => sum + item.max, 0));
  return {
    obtained,
    max,
    percentage: max > 0 ? round2((obtained / max) * 100) : null,
    gradedCount: graded.length,
    pendingCount: items.length - graded.length,
  };
}

export const marksService = {
  /** Student's own marks grouped per course. Never another student's (403). */
  async myMarks(ctx: RequestContext, courseId?: string, studentId?: string) {
    if (ctx.user.role !== 'student') throw forbidden('Only students have personal marks.');
    if (studentId && studentId !== ctx.user.id)
      throw forbidden('You can only view your own marks.');
    if (courseId) await courseRole(ctx, courseId);

    await quizzesRepository.finalizeExpired();
    const items = await marksRepository.forStudent(ctx.db, ctx.user.id, courseId);
    const courseIds = courseId
      ? [courseId]
      : await coursesRepository.courseIdsForStudent(ctx.db, ctx.user.id);
    const courses = await coursesRepository.findByIds(ctx.db, courseIds);

    const perCourse = courses.map((course) => {
      const courseItems = items
        .filter((item) => item.courseId === course.id)
        .sort((a, b) => (a.gradedAt ?? '9999').localeCompare(b.gradedAt ?? '9999'))
        .map((item) => ({
          kind: item.kind,
          itemId: item.itemId,
          title: item.title,
          obtained: item.obtained,
          max: item.max,
          status: item.obtained === null ? ('pending' as const) : ('graded' as const),
          gradedAt: item.gradedAt,
        }));
      return {
        course: { id: course.id, code: course.code, title: course.title },
        items: courseItems,
        totals: computeTotals(courseItems),
      };
    });
    return { courses: perCourse, overall: computeTotals(items) };
  },

  /** Matrix of students x items with totals (teachers of the course, admins). */
  async gradebook(ctx: RequestContext, courseId: string) {
    await assertCourseStaff(ctx, courseId);
    await quizzesRepository.finalizeExpired();
    const [course, students, assignments, quizzes, marks] = await Promise.all([
      coursesRepository.findById(ctx.db, courseId),
      coursesRepository.students(ctx.db, courseId),
      assignmentsRepository.listAllByCourse(ctx.db, courseId),
      quizzesRepository.listByCourse(ctx.db, courseId, false),
      marksRepository.forCourse(ctx.db, courseId),
    ]);
    const quizStats = await quizzesRepository.questionStats(
      supabaseAdmin,
      quizzes.map((q) => q.id),
    );

    const items = [
      ...assignments.map((a) => ({
        id: a.id,
        kind: 'assignment' as const,
        title: a.title,
        max: a.maxMarks,
        date: a.dueAt,
      })),
      ...quizzes
        .filter((q) => q.isPublished)
        .map((q) => ({
          id: q.id,
          kind: 'quiz' as const,
          title: q.title,
          max: quizStats.get(q.id)?.totalMarks ?? 0,
          date: q.opensAt,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const rows = students.map((student) => {
      const cells: Record<
        string,
        {
          obtained: number | null;
          status: 'graded' | 'pending' | 'missing';
          sourceId: string | null;
        }
      > = {};
      const graded: Array<{ obtained: number | null; max: number }> = [];
      for (const item of items) {
        const mark = marks.find((m) => m.studentId === student.id && m.itemId === item.id);
        cells[item.id] = mark
          ? {
              obtained: mark.obtained,
              status: mark.obtained === null ? 'pending' : 'graded',
              sourceId: mark.sourceId,
            }
          : { obtained: null, status: 'missing', sourceId: null };
        if (mark) graded.push({ obtained: mark.obtained, max: item.max });
      }
      return {
        student: {
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          rollNo: student.rollNo,
        },
        cells,
        totals: computeTotals(graded),
      };
    });

    return {
      course: course
        ? { id: course.id, code: course.code, title: course.title }
        : { id: courseId, code: '', title: '' },
      items: items.map(({ date: _date, ...item }) => item),
      rows,
    };
  },

  async gradebookCsv(
    ctx: RequestContext,
    courseId: string,
  ): Promise<{ fileName: string; csv: string }> {
    const book = await this.gradebook(ctx, courseId);
    const header = [
      'Student',
      'Roll No',
      'Email',
      ...book.items.map((item) => `${item.title} (${item.kind}, /${item.max})`),
      'Total obtained',
      'Total max',
      'Percentage',
    ];
    const rows = book.rows.map((row) => [
      row.student.fullName,
      row.student.rollNo ?? '',
      row.student.email,
      ...book.items.map((item) => {
        const cell = row.cells[item.id];
        if (!cell || cell.status === 'missing') return '';
        return cell.status === 'pending' ? 'Pending' : (cell.obtained ?? '');
      }),
      row.totals.obtained,
      row.totals.max,
      row.totals.percentage === null ? '' : `${row.totals.percentage}%`,
    ]);
    const safeCode = (book.course.code || 'course').replace(/[^A-Za-z0-9-]/g, '');
    return { fileName: `${safeCode}-gradebook.csv`, csv: toCsv([header, ...rows]) };
  },
};
