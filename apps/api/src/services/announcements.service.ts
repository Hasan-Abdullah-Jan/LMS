import { supabaseAdmin } from '../config/supabase.js';
import { forbidden, notFound } from '../lib/errors.js';
import type { Pagination } from '../lib/pagination.js';
import {
  announcementsRepository,
  type FeedScope,
} from '../repositories/announcements.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { coursesRepository } from '../repositories/courses.repository.js';
import type { RequestContext } from '../types/auth.js';
import { assertCourseStaff, courseRole } from './access.service.js';

/** Students: global + enrolled. Teachers: global + taught. Admins: everything. */
async function feedScope(ctx: RequestContext): Promise<FeedScope> {
  const { id, role } = ctx.user;
  if (role === 'admin') return { userId: id, courseIds: null };
  const courseIds =
    role === 'student'
      ? await coursesRepository.courseIdsForStudent(ctx.db, id)
      : await coursesRepository.courseIdsForTeacher(ctx.db, id);
  return { userId: id, courseIds };
}

async function requireOwnOrAdmin(ctx: RequestContext, id: string) {
  const existing = await announcementsRepository.findById(supabaseAdmin, id, ctx.user.id);
  if (!existing) throw notFound('Announcement');
  if (existing.courseId) await courseRole(ctx, existing.courseId);
  if (ctx.user.role !== 'admin' && existing.authorId !== ctx.user.id) {
    throw forbidden('Only the author or an administrator can change this announcement.');
  }
  return existing;
}

export const announcementsService = {
  async feed(ctx: RequestContext, filters: Pagination & { courseId?: string | undefined }) {
    const scope = await feedScope(ctx);
    if (filters.courseId === 'global')
      return announcementsRepository.feed(ctx.db, { ...scope, globalOnly: true }, filters);
    if (filters.courseId) {
      await courseRole(ctx, filters.courseId);
      return announcementsRepository.feed(
        ctx.db,
        { ...scope, courseId: filters.courseId },
        filters,
      );
    }
    return announcementsRepository.feed(ctx.db, scope, filters);
  },

  async unreadCount(ctx: RequestContext) {
    return { count: await announcementsRepository.unreadCount(ctx.db, await feedScope(ctx)) };
  },

  /** Mark everything visible up to a timestamp (default: now) as read. */
  async markRead(ctx: RequestContext, upTo?: string) {
    const scope = await feedScope(ctx);
    const ids = await announcementsRepository.unreadIdsUpTo(
      ctx.db,
      scope,
      upTo ?? new Date().toISOString(),
    );
    await announcementsRepository.markRead(ctx.db, ctx.user.id, ids);
    return { marked: ids.length };
  },

  /** null courseId (global) is admin-only; course posts need the course's teacher (or admin). */
  async create(
    ctx: RequestContext,
    input: { courseId: string | null; title: string; body: string; isPinned: boolean },
  ) {
    if (input.courseId === null) {
      if (ctx.user.role !== 'admin')
        throw forbidden('Only administrators can post global announcements.');
    } else {
      await assertCourseStaff(ctx, input.courseId);
    }
    const id = await announcementsRepository.insert(ctx.db, { ...input, authorId: ctx.user.id });
    await auditRepository.record(ctx.user.id, 'announcement.create', 'announcement', id, {
      courseId: input.courseId,
      title: input.title,
    });
    return announcementsRepository.findById(ctx.db, id, ctx.user.id);
  },

  async update(
    ctx: RequestContext,
    id: string,
    patch: {
      title?: string | undefined;
      body?: string | undefined;
      isPinned?: boolean | undefined;
    },
  ) {
    await requireOwnOrAdmin(ctx, id);
    await announcementsRepository.update(ctx.db, id, patch);
    await auditRepository.record(ctx.user.id, 'announcement.update', 'announcement', id);
    return announcementsRepository.findById(ctx.db, id, ctx.user.id);
  },

  async remove(ctx: RequestContext, id: string) {
    const existing = await requireOwnOrAdmin(ctx, id);
    if (!(await announcementsRepository.delete(ctx.db, id))) throw forbidden();
    await auditRepository.record(ctx.user.id, 'announcement.delete', 'announcement', id, {
      title: existing.title,
    });
  },
};
