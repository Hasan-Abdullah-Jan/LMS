import { supabaseAdmin } from '../config/supabase.js';
import { forbidden, notFound } from '../lib/errors.js';
import { now } from '../lib/time.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { chatRepository } from '../repositories/chat.repository.js';
import type { RequestContext } from '../types/auth.js';
import { courseRole } from './access.service.js';

export const SENDER_DELETE_WINDOW_MS = 5 * 60 * 1000;

export const chatService = {
  async history(ctx: RequestContext, courseId: string, before: string | undefined, limit: number) {
    await courseRole(ctx, courseId);
    return chatRepository.history(ctx.db, courseId, before, limit);
  },

  /** Teachers of the course and enrolled students can post. Admins read only. */
  async send(ctx: RequestContext, courseId: string, body: string) {
    const role = await courseRole(ctx, courseId);
    if (role === 'admin')
      throw forbidden('Administrators can read classroom chats but not post in them.');
    return chatRepository.insert(ctx.db, { courseId, senderId: ctx.user.id, body });
  },

  /** Soft delete: sender within 5 minutes, any teacher of the course, or an admin. */
  async remove(ctx: RequestContext, id: string) {
    const message = await chatRepository.findById(supabaseAdmin, id);
    if (!message) throw notFound('Message');
    const role = await courseRole(ctx, message.courseId);
    if (message.deletedAt) return message;

    const isSender = message.senderId === ctx.user.id;
    const withinWindow =
      now().getTime() - new Date(message.createdAt).getTime() <= SENDER_DELETE_WINDOW_MS;
    if (role === 'student' && !(isSender && withinWindow)) {
      throw forbidden(
        isSender
          ? 'Messages can only be deleted within 5 minutes of sending.'
          : 'You can only delete your own messages.',
      );
    }
    if (role === 'teacher' || role === 'admin' || (isSender && withinWindow)) {
      const deleted = await chatRepository.softDelete(ctx.db, id, ctx.user.id);
      if (!deleted) throw forbidden('This message can no longer be deleted.');
      if (!isSender) {
        await auditRepository.record(ctx.user.id, 'chat.delete', 'chat_message', id, {
          courseId: message.courseId,
        });
      }
      return deleted;
    }
    throw forbidden();
  },
};
