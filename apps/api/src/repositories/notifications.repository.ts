import type { Db } from '../config/supabase.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { unwrap, unwrapList } from '../lib/db.js';
import { toRange, type Pagination } from '../lib/pagination.js';
import type { Row } from './mappers.js';

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const toNotification = (row: Row<'notifications'>): Notification => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  link: row.link,
  readAt: row.read_at,
  createdAt: row.created_at,
});

export const notificationsRepository = {
  /** Server-side fan-out (service role); failures are logged, not thrown. */
  async create(input: {
    userId: string;
    kind: string;
    title: string;
    body?: string;
    link?: string;
  }) {
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
    if (error) logger.error({ err: error.message }, 'Notification insert failed');
  },

  async list(db: Db, userId: string, pagination: Pagination) {
    const [from, to] = toRange(pagination);
    const result = await db
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    const rows = unwrapList(result, 'Notification');
    return { rows: rows.map(toNotification), total: result.count ?? rows.length };
  },

  async unreadCount(db: Db, userId: string): Promise<number> {
    const result = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    unwrap(result, 'Notification');
    return result.count ?? 0;
  },

  async markAllRead(db: Db, userId: string): Promise<void> {
    unwrap(
      await db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null),
      'Notification',
    );
  },
};
