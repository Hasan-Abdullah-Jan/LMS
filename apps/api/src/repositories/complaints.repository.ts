import type { Db } from '../config/supabase.js';
import { unwrap, unwrapList, unwrapRequired } from '../lib/db.js';
import { toRange, type Pagination } from '../lib/pagination.js';
import { escapeLike } from './profiles.repository.js';
import type { Row } from './mappers.js';

export type ComplaintStatus = Row<'complaints'>['status'];
export const COMPLAINT_CATEGORIES = [
  'academic',
  'technical',
  'facility',
  'conduct',
  'other',
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export interface Complaint {
  id: string;
  raisedBy: { id: string; fullName: string; email: string; role: string } | null;
  raisedById: string;
  course: { id: string; code: string; title: string } | null;
  category: ComplaintCategory;
  subject: string;
  description: string;
  attachmentName: string | null;
  status: ComplaintStatus;
  adminResponse: string | null;
  resolvedBy: { id: string; fullName: string } | null;
  resolvedAt: string | null;
  followUp: string | null;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintRecord extends Complaint {
  attachmentPath: string | null;
}

type ComplaintRow = Row<'complaints'> & {
  raiser: { id: string; full_name: string; email: string; role: string } | null;
  resolver: { id: string; full_name: string } | null;
  course: { id: string; code: string; title: string } | null;
};

const SELECT =
  '*, raiser:profiles!complaints_raised_by_fkey(id, full_name, email, role), resolver:profiles!complaints_resolved_by_fkey(id, full_name), course:courses(id, code, title)';

function toRecord(row: ComplaintRow): ComplaintRecord {
  return {
    id: row.id,
    raisedBy: row.raiser
      ? {
          id: row.raiser.id,
          fullName: row.raiser.full_name,
          email: row.raiser.email,
          role: row.raiser.role,
        }
      : null,
    raisedById: row.raised_by,
    course: row.course,
    category: row.category as ComplaintCategory,
    subject: row.subject,
    description: row.description,
    attachmentName: row.attachment_name,
    attachmentPath: row.attachment_path,
    status: row.status,
    adminResponse: row.admin_response,
    resolvedBy: row.resolver ? { id: row.resolver.id, fullName: row.resolver.full_name } : null,
    resolvedAt: row.resolved_at,
    followUp: row.follow_up,
    followUpAt: row.follow_up_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toComplaint(record: ComplaintRecord): Complaint {
  const { attachmentPath: _path, ...complaint } = record;
  return complaint;
}

export interface ComplaintFilters extends Pagination {
  status?: ComplaintStatus | undefined;
  category?: ComplaintCategory | undefined;
  search?: string | undefined;
}

export const complaintsRepository = {
  async insert(
    db: Db,
    input: {
      raisedBy: string;
      courseId: string | null;
      category: ComplaintCategory;
      subject: string;
      description: string;
      attachmentPath: string | null;
      attachmentName: string | null;
    },
  ): Promise<ComplaintRecord> {
    const row = unwrapRequired(
      await db
        .from('complaints')
        .insert({
          raised_by: input.raisedBy,
          course_id: input.courseId,
          category: input.category,
          subject: input.subject,
          description: input.description,
          attachment_path: input.attachmentPath,
          attachment_name: input.attachmentName,
        })
        .select(SELECT)
        .single(),
      'Complaint',
    );
    return toRecord(row as unknown as ComplaintRow);
  },

  async list(db: Db, filters: ComplaintFilters & { raisedBy?: string | undefined }) {
    const [from, to] = toRange(filters);
    let query = db
      .from('complaints')
      .select(SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (filters.raisedBy) query = query.eq('raised_by', filters.raisedBy);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.search) query = query.ilike('subject', `%${escapeLike(filters.search)}%`);
    const result = await query;
    const rows = unwrapList(result, 'Complaint') as unknown as ComplaintRow[];
    return { rows: rows.map(toRecord), total: result.count ?? rows.length };
  },

  async findById(db: Db, id: string): Promise<ComplaintRecord | null> {
    const row = unwrap(
      await db.from('complaints').select(SELECT).eq('id', id).maybeSingle(),
      'Complaint',
    );
    return row ? toRecord(row as unknown as ComplaintRow) : null;
  },

  async update(
    db: Db,
    id: string,
    patch: {
      status?: ComplaintStatus | undefined;
      adminResponse?: string | undefined;
      followUp?: string | undefined;
    },
  ): Promise<ComplaintRecord> {
    const row = unwrapRequired(
      await db
        .from('complaints')
        .update({
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.adminResponse !== undefined && { admin_response: patch.adminResponse }),
          ...(patch.followUp !== undefined && { follow_up: patch.followUp }),
        })
        .eq('id', id)
        .select(SELECT)
        .maybeSingle(),
      'Complaint',
    );
    return toRecord(row as unknown as ComplaintRow);
  },

  async countByStatus(db: Db): Promise<Record<ComplaintStatus, number>> {
    const statuses: ComplaintStatus[] = ['open', 'in_review', 'resolved', 'rejected'];
    const counts = await Promise.all(
      statuses.map(async (status) => {
        const result = await db
          .from('complaints')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        unwrap(result, 'Complaint');
        return [status, result.count ?? 0] as const;
      }),
    );
    return Object.fromEntries(counts) as Record<ComplaintStatus, number>;
  },
};
