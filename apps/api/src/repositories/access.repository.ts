import { supabaseAdmin } from '../config/supabase.js';
import { unwrap } from '../lib/db.js';

export interface CourseAccess {
  exists: boolean;
  isArchived: boolean;
  teaches: boolean;
  enrolled: boolean;
}

/**
 * Authorization lookups. Uses the service role so the API can tell "does not
 * exist" (404) apart from "not a member" (403); the data itself is then read
 * with the caller's JWT so RLS still applies.
 */
export const accessRepository = {
  async courseAccess(courseId: string, userId: string): Promise<CourseAccess> {
    const [course, teacher, enrollment] = await Promise.all([
      supabaseAdmin.from('courses').select('id, is_archived').eq('id', courseId).maybeSingle(),
      supabaseAdmin
        .from('course_teachers')
        .select('course_id')
        .eq('course_id', courseId)
        .eq('teacher_id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('enrollments')
        .select('course_id')
        .eq('course_id', courseId)
        .eq('student_id', userId)
        .maybeSingle(),
    ]);
    const courseRow = unwrap(course, 'Course');
    return {
      exists: Boolean(courseRow),
      isArchived: courseRow?.is_archived ?? false,
      teaches: Boolean(unwrap(teacher, 'Course')),
      enrolled: Boolean(unwrap(enrollment, 'Course')),
    };
  },

  /** Resolve the course that owns an item, for item-level routes (/assignments/:id ...). */
  async courseIdOf(
    table: 'assignments' | 'quizzes' | 'resources' | 'chat_messages' | 'announcements',
    id: string,
  ): Promise<string | null> {
    const row = unwrap(
      await supabaseAdmin.from(table).select('course_id').eq('id', id).maybeSingle(),
    );
    return (row as { course_id: string | null } | null)?.course_id ?? null;
  },
};
