import type { Pagination } from '../lib/pagination.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { notificationsRepository } from '../repositories/notifications.repository.js';
import type { RequestContext } from '../types/auth.js';

export const notificationsService = {
  list: (ctx: RequestContext, pagination: Pagination) =>
    notificationsRepository.list(ctx.db, ctx.user.id, pagination),

  unreadCount: async (ctx: RequestContext) => ({
    count: await notificationsRepository.unreadCount(ctx.db, ctx.user.id),
  }),

  markAllRead: (ctx: RequestContext) => notificationsRepository.markAllRead(ctx.db, ctx.user.id),
};

export const auditService = {
  list: (pagination: Pagination) => auditRepository.list(pagination),
};
