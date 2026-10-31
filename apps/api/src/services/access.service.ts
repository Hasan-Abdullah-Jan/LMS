import { forbidden, notFound } from '../lib/errors.js';
import { accessRepository } from '../repositories/access.repository.js';
import type { RequestContext } from '../types/auth.js';

/** The caller's role *within a specific course*. */
export type CourseRole = 'admin' | 'teacher' | 'student';

/**
 * First line of authorization for every course-scoped route.
 * 404 when the course does not exist; 403 when the caller is not a member.
 */
export async function courseRole(ctx: RequestContext, courseId: string): Promise<CourseRole> {
  const access = await accessRepository.courseAccess(courseId, ctx.user.id);
  if (!access.exists) throw notFound('Course');
  if (ctx.user.role === 'admin') return 'admin';
  if (access.isArchived) throw forbidden('This course has been archived.');
  if (ctx.user.role === 'teacher' && access.teaches) return 'teacher';
  if (ctx.user.role === 'student' && access.enrolled) return 'student';
  throw forbidden('You are not a member of this course.');
}

/** Teachers of the course and admins. */
export async function assertCourseStaff(
  ctx: RequestContext,
  courseId: string,
): Promise<CourseRole> {
  const role = await courseRole(ctx, courseId);
  if (role === 'student') throw forbidden("Only this course's teachers can do this.");
  return role;
}

/** Enrolled students only. */
export async function assertCourseStudent(ctx: RequestContext, courseId: string): Promise<void> {
  const role = await courseRole(ctx, courseId);
  if (role !== 'student') throw forbidden('Only enrolled students can do this.');
}

/** Resolve the owning course of an item, then check membership (404 if the item is missing). */
export async function itemCourse(
  ctx: RequestContext,
  table: Parameters<typeof accessRepository.courseIdOf>[0],
  id: string,
  label: string,
): Promise<{ courseId: string; role: CourseRole }> {
  const courseId = await accessRepository.courseIdOf(table, id);
  if (!courseId) throw notFound(label);
  return { courseId, role: await courseRole(ctx, courseId) };
}
