import type { Db } from '../config/supabase.js';
import { unwrap, unwrapList, unwrapRequired } from '../lib/db.js';
import { toRange, type Pagination } from '../lib/pagination.js';
import { num, type Row } from './mappers.js';

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  maxMarks: number;
  dueAt: string;
  allowLate: boolean;
  attachmentName: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentRecord extends Assignment {
  attachmentPath: string | null;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  textAnswer: string | null;
  fileName: string | null;
  submittedAt: string;
  isLate: boolean;
  marksObtained: number | null;
  feedback: string | null;
  gradedAt: string | null;
  gradedBy: string | null;
}

export interface SubmissionRecord extends Submission {
  filePath: string | null;
}

export function toAssignmentRecord(row: Row<'assignments'>): AssignmentRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    instructions: row.instructions,
    maxMarks: Number(row.max_marks),
    dueAt: row.due_at,
    allowLate: row.allow_late,
    attachmentName: row.attachment_name,
    attachmentPath: row.attachment_path,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAssignment(record: AssignmentRecord): Assignment {
  const { attachmentPath: _path, ...assignment } = record;
  return assignment;
}

export function toSubmissionRecord(row: Row<'submissions'>): SubmissionRecord {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    textAnswer: row.text_answer,
    fileName: row.file_name,
    filePath: row.file_path,
    submittedAt: row.submitted_at,
    isLate: row.is_late,
    marksObtained: num(row.marks_obtained),
    feedback: row.feedback,
    gradedAt: row.graded_at,
    gradedBy: row.graded_by,
  };
}

export function toSubmission(record: SubmissionRecord): Submission {
  const { filePath: _path, ...submission } = record;
  return submission;
}

export interface AssignmentInput {
  title?: string | undefined;
  instructions?: string | undefined;
  maxMarks?: number | undefined;
  dueAt?: string | undefined;
  allowLate?: boolean | undefined;
}

export const assignmentsRepository = {
  async listByCourse(db: Db, courseId: string, pagination: Pagination) {
    const [from, to] = toRange(pagination);
    const result = await db
      .from('assignments')
      .select('*', { count: 'exact' })
      .eq('course_id', courseId)
      .order('due_at', { ascending: true })
      .range(from, to);
    const rows = unwrapList(result, 'Assignment');
    return { rows: rows.map(toAssignmentRecord), total: result.count ?? rows.length };
  },

  async listAllByCourse(db: Db, courseId: string): Promise<AssignmentRecord[]> {
    const rows = unwrapList(
      await db.from('assignments').select('*').eq('course_id', courseId).order('due_at').limit(1000),
      'Assignment',
    );
    return rows.map(toAssignmentRecord);
  },

  async findById(db: Db, id: string): Promise<AssignmentRecord | null> {
    const row = unwrap(await db.from('assignments').select('*').eq('id', id).maybeSingle(), 'Assignment');
    return row ? toAssignmentRecord(row) : null;
  },

  async insert(
    db: Db,
    input: Required<AssignmentInput> & {
      courseId: string;
      createdBy: string;
      attachmentPath: string | null;
      attachmentName: string | null;
    },
  ): Promise<AssignmentRecord> {
    const row = unwrapRequired(
      await db
        .from('assignments')
        .insert({
          course_id: input.courseId,
          created_by: input.createdBy,
          title: input.title,
          instructions: input.instructions,
          max_marks: input.maxMarks,
          due_at: input.dueAt,
          allow_late: input.allowLate,
          attachment_path: input.attachmentPath,
          attachment_name: input.attachmentName,
        })
        .select('*')
        .single(),
      'Assignment',
    );
    return toAssignmentRecord(row);
  },

  async update(db: Db, id: string, input: AssignmentInput): Promise<AssignmentRecord> {
    const row = unwrapRequired(
      await db
        .from('assignments')
        .update({
          ...(input.title !== undefined && { title: input.title }),
          ...(input.instructions !== undefined && { instructions: input.instructions }),
          ...(input.maxMarks !== undefined && { max_marks: input.maxMarks }),
          ...(input.dueAt !== undefined && { due_at: input.dueAt }),
          ...(input.allowLate !== undefined && { allow_late: input.allowLate }),
        })
        .eq('id', id)
        .select('*')
        .maybeSingle(),
      'Assignment',
    );
    return toAssignmentRecord(row);
  },

  async delete(db: Db, id: string): Promise<boolean> {
    const rows = unwrapList(await db.from('assignments').delete().eq('id', id).select('id'), 'Assignment');
    return rows.length > 0;
  },

  /** Assignments due between now and `until` across the given courses. */
  async upcoming(db: Db, courseIds: string[], from: string, until: string): Promise<AssignmentRecord[]> {
    if (courseIds.length === 0) return [];
    const rows = unwrapList(
      await db
        .from('assignments')
        .select('*')
        .in('course_id', courseIds)
        .gte('due_at', from)
        .lte('due_at', until)
        .order('due_at')
        .limit(50),
      'Assignment',
    );
    return rows.map(toAssignmentRecord);
  },

  async idsForCourses(db: Db, courseIds: string[]): Promise<AssignmentRecord[]> {
    if (courseIds.length === 0) return [];
    const rows = unwrapList(
      await db.from('assignments').select('*').in('course_id', courseIds).limit(2000),
      'Assignment',
    );
    return rows.map(toAssignmentRecord);
  },

  /** Submissions waiting for a grade, oldest first. */
  async ungraded(db: Db, assignmentIds: string[], limit = 200): Promise<SubmissionRecord[]> {
    if (assignmentIds.length === 0) return [];
    const rows = unwrapList(
      await db
        .from('submissions')
        .select('*')
        .in('assignment_id', assignmentIds)
        .is('graded_at', null)
        .order('submitted_at')
        .limit(limit),
      'Submission',
    );
    return rows.map(toSubmissionRecord);
  },

  // ------------------------------------------------------------ submissions
  async submissionsForAssignments(db: Db, assignmentIds: string[]): Promise<SubmissionRecord[]> {
    if (assignmentIds.length === 0) return [];
    const rows = unwrapList(
      await db.from('submissions').select('*').in('assignment_id', assignmentIds),
      'Submission',
    );
    return rows.map(toSubmissionRecord);
  },

  async findSubmission(db: Db, assignmentId: string, studentId: string): Promise<SubmissionRecord | null> {
    const row = unwrap(
      await db
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .maybeSingle(),
      'Submission',
    );
    return row ? toSubmissionRecord(row) : null;
  },

  async findSubmissionById(db: Db, id: string): Promise<SubmissionRecord | null> {
    const row = unwrap(await db.from('submissions').select('*').eq('id', id).maybeSingle(), 'Submission');
    return row ? toSubmissionRecord(row) : null;
  },

  /** Create or replace the caller's submission. The DB trigger stamps time/lateness and clears grades. */
  async upsertSubmission(
    db: Db,
    input: {
      assignmentId: string;
      studentId: string;
      textAnswer: string | null;
      filePath: string | null;
      fileName: string | null;
      isLate: boolean;
    },
  ): Promise<SubmissionRecord> {
    const row = unwrapRequired(
      await db
        .from('submissions')
        .upsert(
          {
            assignment_id: input.assignmentId,
            student_id: input.studentId,
            text_answer: input.textAnswer,
            file_path: input.filePath,
            file_name: input.fileName,
            submitted_at: new Date().toISOString(),
            is_late: input.isLate,
            marks_obtained: null,
            feedback: null,
            graded_by: null,
            graded_at: null,
          },
          { onConflict: 'assignment_id,student_id' },
        )
        .select('*')
        .single(),
      'Submission',
    );
    return toSubmissionRecord(row);
  },

  async grade(
    db: Db,
    id: string,
    input: { marks: number; feedback: string | null; gradedBy: string },
  ): Promise<SubmissionRecord> {
    const row = unwrapRequired(
      await db
        .from('submissions')
        .update({
          marks_obtained: input.marks,
          feedback: input.feedback,
          graded_by: input.gradedBy,
          graded_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .maybeSingle(),
      'Submission',
    );
    return toSubmissionRecord(row);
  },

  async maxGradedMarks(db: Db, assignmentId: string): Promise<number | null> {
    const row = unwrap(
      await db
        .from('submissions')
        .select('marks_obtained')
        .eq('assignment_id', assignmentId)
        .not('marks_obtained', 'is', null)
        .order('marks_obtained', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'Submission',
    );
    return row ? num(row.marks_obtained) : null;
  },
};
