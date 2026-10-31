import type { Db } from '../config/supabase.js';
import { unwrap, unwrapList, unwrapRequired } from '../lib/db.js';
import type { Row } from './mappers.js';

export interface ChatMessage {
  id: string;
  courseId: string;
  sender: { id: string; fullName: string; role: string } | null;
  senderId: string;
  /** null once deleted - the original text is never returned. */
  body: string | null;
  createdAt: string;
  deletedAt: string | null;
}

type MessageRow = Row<'chat_messages'> & { sender: { id: string; full_name: string; role: string } | null };

const SELECT = '*, sender:profiles!chat_messages_sender_id_fkey(id, full_name, role)';

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    courseId: row.course_id,
    sender: row.sender ? { id: row.sender.id, fullName: row.sender.full_name, role: row.sender.role } : null,
    senderId: row.sender_id,
    body: row.deleted_at ? null : row.body,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export const chatRepository = {
  /** Newest `limit` messages strictly before the cursor, returned oldest -> newest. */
  async history(db: Db, courseId: string, before: string | undefined, limit: number) {
    let query = db
      .from('chat_messages')
      .select(SELECT)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);
    if (before) query = query.lt('created_at', before);
    const rows = unwrapList(await query, 'Message') as unknown as MessageRow[];
    const hasMore = rows.length > limit;
    return { messages: rows.slice(0, limit).reverse().map(toMessage), hasMore };
  },

  async findById(db: Db, id: string): Promise<ChatMessage | null> {
    const row = unwrap(await db.from('chat_messages').select(SELECT).eq('id', id).maybeSingle(), 'Message');
    return row ? toMessage(row as unknown as MessageRow) : null;
  },

  async insert(db: Db, input: { courseId: string; senderId: string; body: string }): Promise<ChatMessage> {
    const row = unwrapRequired(
      await db
        .from('chat_messages')
        .insert({ course_id: input.courseId, sender_id: input.senderId, body: input.body })
        .select(SELECT)
        .single(),
      'Message',
    );
    return toMessage(row as unknown as MessageRow);
  },

  async softDelete(db: Db, id: string, deletedBy: string): Promise<ChatMessage | null> {
    const row = unwrap(
      await db
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
        .eq('id', id)
        .is('deleted_at', null)
        .select(SELECT)
        .maybeSingle(),
      'Message',
    );
    return row ? toMessage(row as unknown as MessageRow) : null;
  },
};
