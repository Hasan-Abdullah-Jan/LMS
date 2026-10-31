import { supabaseAdmin } from '../config/supabase.js';
import { now } from '../lib/time.js';
import { announcementsRepository } from '../repositories/announcements.repository.js';
import { assignmentsRepository, toAssignment } from '../repositories/assignments.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { complaintsRepository } from '../repositories/complaints.repository.js';
import { coursesRepository } from '../repositories/courses.repository.js';
import { marksRepository } from '../repositories/marks.repository.js';
import { profilesRepository } from '../repositories/profiles.repository.js';
import { quizzesRepository } from '../repositories/quizzes.repository.js';
import type { RequestContext } from '../types/auth.js';
import { computeTotals } from './marks.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function latestAnnouncements(ctx: RequestContext, courseIds: string[] | null) {
  const { rows } = await announcementsRepository.feed(
    ctx.db,
    { userId: ctx.user.id, courseIds },
    { page: 1, pageSize: 5 },
  );
  return rows;
}

export const dashboardService = {
  async summary(ctx: RequestContext) {
    const at = now();
    const { role, id } = ctx.user;

    if (role === 'admin') {
      const [users, courses, complaints, audit, announcements] = await Promise.all([
        profilesRepository.countByRole(ctx.db),
        coursesRepository.count(ctx.db),
        complaintsRepository.countByStatus(ctx.db),
        auditRepository.list({ page: 1, pageSize: 6 }),
        latestAnnouncements(ctx, null),
      ]);
      return { role, users, courses, complaints, recentActivity: audit.rows, announcements };
    }

    const courses = await coursesRepository.findByIds(
      ctx.db,
      role === 'student'
        ? await coursesRepository.courseIdsForStudent(ctx.db, id)
        : await coursesRepository.courseIdsForTeacher(ctx.db, id),
    );
    const courseIds = courses.map((c) => c.id);
    const courseLabel = (courseId: string) => {
      const course = courses.find((c) => c.id === courseId);
      return course ? { id: course.id, code: course.code, title: course.title } : null;
    };
    const upcomingAssignments = await assignmentsRepository.upcoming(
      ctx.db,
      courseIds,
      at.toISOString(),
      new Date(at.getTime() + 14 * DAY_MS).toISOString(),
    );
    const announcements = await latestAnnouncements(ctx, courseIds);

    if (role === 'student') {
      await quizzesRepository.finalizeExpired();
      const [submissions, openQuizzes, marks] = await Promise.all([
        assignmentsRepository.submissionsForAssignments(ctx.db, upcomingAssignments.map((a) => a.id)),
        quizzesRepository.openForCourses(ctx.db, courseIds, at.toISOString()),
        marksRepository.forStudent(ctx.db, id),
      ]);
      const attempts = await quizzesRepository.attemptsForQuizzes(ctx.db, openQuizzes.map((q) => q.id));
      const recentMarks = marks
        .filter((m) => m.obtained !== null && m.gradedAt)
        .sort((a, b) => (b.gradedAt ?? '').localeCompare(a.gradedAt ?? ''))
        .slice(0, 5)
        .map((m) => ({ ...m, course: courseLabel(m.courseId) }));
      return {
        role,
        courses,
        upcomingAssignments: upcomingAssignments.map((a) => ({
          ...toAssignment(a),
          course: courseLabel(a.courseId),
          submitted: submissions.some((s) => s.assignmentId === a.id && s.studentId === id),
        })),
        openQuizzes: openQuizzes
          .filter((q) => !attempts.some((a) => a.quizId === q.id && a.submittedAt))
          .map((q) => ({ ...q, course: courseLabel(q.courseId) })),
        recentMarks,
        overall: computeTotals(marks),
        announcements,
      };
    }

    // teacher
    const assignments = await assignmentsRepository.idsForCourses(ctx.db, courseIds);
    const ungraded = await assignmentsRepository.ungraded(ctx.db, assignments.map((a) => a.id));
    const students = ungraded.length
      ? await profilesRepository.findByIds(supabaseAdmin, [...new Set(ungraded.map((s) => s.studentId))])
      : [];
    return {
      role,
      courses,
      toGradeCount: ungraded.length,
      toGrade: ungraded.slice(0, 6).map((submission) => {
        const assignment = assignments.find((a) => a.id === submission.assignmentId)!;
        return {
          submissionId: submission.id,
          submittedAt: submission.submittedAt,
          isLate: submission.isLate,
          student: students.find((s) => s.id === submission.studentId)?.fullName ?? 'Student',
          assignment: { id: assignment.id, title: assignment.title, courseId: assignment.courseId },
          course: courseLabel(assignment.courseId),
        };
      }),
      upcomingAssignments: upcomingAssignments.map((a) => ({ ...toAssignment(a), course: courseLabel(a.courseId) })),
      announcements,
    };
  },
};
