import type { Db } from '../config/supabase.js';
import { unwrap, unwrapList, unwrapRequired } from '../lib/db.js';
import { toRange, type Pagination } from '../lib/pagination.js';
import { escapeLike } from './profiles.repository.js';
import type { Row } from './mappers.js';

export interface Resource {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; fullName: string } | null;
}

export interface ResourceRecord extends Resource {
  filePath: string;
  uploaderId: string;
}

type ResourceRow = Row<'resources'> & { uploader: { id: string; full_name: string } | null };

const SELECT = '*, uploader:profiles!resources_uploaded_by_fkey(id, full_name)';

function toRecord(row: ResourceRow): ResourceRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
    uploadedBy: row.uploader ? { id: row.uploader.id, fullName: row.uploader.full_name } : null,
    filePath: row.file_path,
    uploaderId: row.uploaded_by,
  };
}

/** Public shape: never leak storage paths. */
export function toResource(record: ResourceRecord): Resource {
  const { filePath: _filePath, uploaderId: _uploaderId, ...resource } = record;
  return resource;
}

export const resourcesRepository = {
  async list(db: Db, courseId: string, filters: Pagination & { search?: string | undefined }) {
    const [from, to] = toRange(filters);
    let query = db
      .from('resources')
      .select(SELECT, { count: 'exact' })
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (filters.search) query = query.ilike('title', `%${escapeLike(filters.search)}%`);
    const result = await query;
    const rows = unwrapList(result, 'Resource') as unknown as ResourceRow[];
    return { rows: rows.map(toRecord), total: result.count ?? rows.length };
  },

  async findById(db: Db, id: string): Promise<ResourceRecord | null> {
    const row = unwrap(await db.from('resources').select(SELECT).eq('id', id).maybeSingle(), 'Resource');
    return row ? toRecord(row as unknown as ResourceRow) : null;
  },

  async insert(
    db: Db,
    input: {
      courseId: string;
      uploadedBy: string;
      title: string;
      description: string | null;
      filePath: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    },
  ): Promise<ResourceRecord> {
    const row = unwrapRequired(
      await db
        .from('resources')
        .insert({
          course_id: input.courseId,
          uploaded_by: input.uploadedBy,
          title: input.title,
          description: input.description,
          file_path: input.filePath,
          file_name: input.fileName,
          mime_type: input.mimeType,
          size_bytes: input.sizeBytes,
        })
        .select(SELECT)
        .single(),
      'Resource',
    );
    return toRecord(row as unknown as ResourceRow);
  },

  async delete(db: Db, id: string): Promise<boolean> {
    const rows = unwrapList(await db.from('resources').delete().eq('id', id).select('id'), 'Resource');
    return rows.length > 0;
  },
};
