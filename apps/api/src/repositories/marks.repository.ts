import type { Db } from '../config/supabase.js';
import { unwrapList } from '../lib/db.js';
import type { Database } from '../types/database.types.js';
import { num } from './mappers.js';

type MarkRow = Database['public']['Views']['v_student_marks']['Row'];

export interface MarkItem {
  studentId: string;
  courseId: string;
  kind: 'assignment' | 'quiz';
  itemId: string;
  title: string;
  obtained: number | null;
  max: number;
  gradedAt: string | null;
  sourceId: string;
}

function toMark(row: MarkRow): MarkItem {
  return {
    studentId: row.student_id!,
    courseId: row.course_id!,
    kind: row.kind as MarkItem['kind'],
    itemId: row.item_id!,
    title: row.title!,
    obtained: num(row.obtained),
    max: num(row.max) ?? 0,
    gradedAt: row.graded_at,
    sourceId: row.source_id!,
  };
}

/** Reads v_student_marks (security_invoker, so the caller's RLS applies). */
export const marksRepository = {
  async forStudent(db: Db, studentId: string, courseId?: string): Promise<MarkItem[]> {
    let query = db.from('v_student_marks').select('*').eq('student_id', studentId).limit(2000);
    if (courseId) query = query.eq('course_id', courseId);
    return unwrapList(await query, 'Marks').map(toMark);
  },

  async forCourse(db: Db, courseId: string): Promise<MarkItem[]> {
    return unwrapList(
      await db.from('v_student_marks').select('*').eq('course_id', courseId).limit(10000),
      'Marks',
    ).map(toMark);
  },
};
