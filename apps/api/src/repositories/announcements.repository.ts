import type { Db } from '../config/supabase.js';
import { unwrap, unwrapList, unwrapRequired } from '../lib/db.js';
import { toRange, type Pagination } from '../lib/pagination.js';
import type { Row } from './mappers.js';

export interface Announcement {
  id: string;
  courseId: string | null;
  course: { id: string; code: string; title: string } | null;
  author: { id: string; fullName: string; role: string } | null;
  authorId: string;
  title: string;
  body: string;
  isPinned: boolean;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

type AnnouncementRow = Row<'announcements'> & {
  course: { id: string; code: string; title: string } | null;
  author: { id: string; full_name: string; role: string } | null;
  announcement_reads: Array<{ user_id: string }>;
};

const SELECT =
  '*, course:courses(id, code, title), author:profiles!announcements_author_id_fkey(id, full_name, role), announcement_reads(user_id)';

function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    courseId: row.course_id,
    course: row.course,
    author: row.author
      ? { id: row.author.id, fullName: row.author.full_name, role: row.author.role }
      : null,
    authorId: row.author_id,
    title: row.title,
    body: row.body,
    isPinned: row.is_pinned,
    isRead: row.announcement_reads.length > 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** PostgREST filter: global announcements plus the given courses. */
function scopeFilter(courseIds: string[]): string {
  return courseIds.length > 0
    ? `course_id.is.null,course_id.in.(${courseIds.join(',')})`
    : 'course_id.is.null';
}

export interface FeedScope {
  userId: string;
  /** null = no restriction (admins). */
  courseIds: string[] | null;
  courseId?: string | undefined;
  globalOnly?: boolean | undefined;
}

export const announcementsRepository = {
  /** Pinned first, newest first. */
  async feed(db: Db, scope: FeedScope, pagination: Pagination) {
    const [from, to] = toRange(pagination);
    let query = db
      .from('announcements')
      .select(SELECT, { count: 'exact' })
      .eq('announcement_reads.user_id', scope.userId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (scope.courseId) query = query.eq('course_id', scope.courseId);
    else if (scope.globalOnly) query = query.is('course_id', null);
    else if (scope.courseIds) query = query.or(scopeFilter(scope.courseIds));
    const result = await query;
    const rows = unwrapList(result, 'Announcement') as unknown as AnnouncementRow[];
    return { rows: rows.map(toAnnouncement), total: result.count ?? rows.length };
  },

  async unreadCount(db: Db, scope: FeedScope): Promise<number> {
    let query = db
      .from('announcements')
      .select('id, announcement_reads!left(user_id)', { count: 'exact', head: true })
      .eq('announcement_reads.user_id', scope.userId)
      .is('announcement_reads', null);
    if (scope.courseIds) query = query.or(scopeFilter(scope.courseIds));
    const result = await query;
    unwrap(result, 'Announcement');
    return result.count ?? 0;
  },

  async unreadIdsUpTo(db: Db, scope: FeedScope, upTo: string): Promise<string[]> {
    let query = db
      .from('announcements')
      .select('id, announcement_reads!left(user_id)')
      .eq('announcement_reads.user_id', scope.userId)
      .is('announcement_reads', null)
      .lte('created_at', upTo)
      .limit(1000);
    if (scope.courseIds) query = query.or(scopeFilter(scope.courseIds));
    return unwrapList(await query, 'Announcement').map((row) => row.id);
  },

  async markRead(db: Db, userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    unwrap(
      await db.from('announcement_reads').upsert(
        ids.map((announcement_id) => ({ user_id: userId, announcement_id })),
        {
          onConflict: 'user_id,announcement_id',
          ignoreDuplicates: true,
        },
      ),
      'Announcement',
    );
  },

  async findById(db: Db, id: string, userId: string): Promise<Announcement | null> {
    const row = unwrap(
      await db
        .from('announcements')
        .select(SELECT)
        .eq('id', id)
        .eq('announcement_reads.user_id', userId)
        .maybeSingle(),
      'Announcement',
    );
    return row ? toAnnouncement(row as unknown as AnnouncementRow) : null;
  },

  async insert(
    db: Db,
    input: {
      courseId: string | null;
      authorId: string;
      title: string;
      body: string;
      isPinned: boolean;
    },
  ): Promise<string> {
    return unwrapRequired(
      await db
        .from('announcements')
        .insert({
          course_id: input.courseId,
          author_id: input.authorId,
          title: input.title,
          body: input.body,
          is_pinned: input.isPinned,
        })
        .select('id')
        .single(),
      'Announcement',
    ).id;
  },

  async update(
    db: Db,
    id: string,
    patch: {
      title?: string | undefined;
      body?: string | undefined;
      isPinned?: boolean | undefined;
    },
  ) {
    unwrapRequired(
      await db
        .from('announcements')
        .update({
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.body !== undefined && { body: patch.body }),
          ...(patch.isPinned !== undefined && { is_pinned: patch.isPinned }),
        })
        .eq('id', id)
        .select('id')
        .maybeSingle(),
      'Announcement',
    );
  },

  async delete(db: Db, id: string): Promise<boolean> {
    return (
      unwrapList(await db.from('announcements').delete().eq('id', id).select('id'), 'Announcement')
        .length > 0
    );
  },
};
