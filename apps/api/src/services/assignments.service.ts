import { supabaseAdmin } from '../config/supabase.js';
import { AppError, conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import {
  buildStoragePath,
  MAX_RESOURCE_BYTES,
  MAX_SUBMISSION_BYTES,
  verifyUpload,
  type UploadedFile,
} from '../lib/files.js';
import type { Pagination } from '../lib/pagination.js';
import { now } from '../lib/time.js';
import {
  assignmentsRepository,
  toAssignment,
  toSubmission,
  type AssignmentInput,
  type AssignmentRecord,
  type Submission,
  type SubmissionRecord,
} from '../repositories/assignments.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { coursesRepository } from '../repositories/courses.repository.js';
import { storageRepository } from '../repositories/storage.repository.js';
import type { RequestContext } from '../types/auth.js';
import { assertCourseStaff, assertCourseStudent, courseRole } from './access.service.js';

export type SubmissionStatus = 'pending' | 'submitted' | 'late' | 'graded' | 'missed';

export function submissionStatus(
  assignment: Pick<AssignmentRecord, 'dueAt' | 'allowLate'>,
  submission: Pick<SubmissionRecord, 'isLate' | 'gradedAt'> | null,
  at: Date = now(),
): SubmissionStatus {
  if (submission?.gradedAt) return 'graded';
  if (submission) return submission.isLate ? 'late' : 'submitted';
  if (at > new Date(assignment.dueAt) && !assignment.allowLate) return 'missed';
  return 'pending';
}

async function requireAssignment(id: string): Promise<AssignmentRecord> {
  const assignment = await assignmentsRepository.findById(supabaseAdmin, id);
  if (!assignment) throw notFound('Assignment');
  return assignment;
}

export const assignmentsService = {
  /** Students get their own submission + status; staff get submission/grading counts. */
  async list(ctx: RequestContext, courseId: string, pagination: Pagination) {
    const role = await courseRole(ctx, courseId);
    const { rows, total } = await assignmentsRepository.listByCourse(ctx.db, courseId, pagination);
    const submissions = await assignmentsRepository.submissionsForAssignments(
      ctx.db,
      rows.map((a) => a.id),
    );

    if (role === 'student') {
      return {
        total,
        rows: rows.map((assignment) => {
          const mine =
            submissions.find(
              (s) => s.assignmentId === assignment.id && s.studentId === ctx.user.id,
            ) ?? null;
          return {
            ...toAssignment(assignment),
            status: submissionStatus(assignment, mine),
            submission: mine ? toSubmission(mine) : null,
          };
        }),
      };
    }

    const enrolled = (await coursesRepository.enrolledStudentIds(ctx.db, courseId)).length;
    return {
      total,
      rows: rows.map((assignment) => {
        const forThis = submissions.filter((s) => s.assignmentId === assignment.id);
        return {
          ...toAssignment(assignment),
          stats: {
            enrolled,
            submitted: forThis.length,
            graded: forThis.filter((s) => s.gradedAt).length,
            late: forThis.filter((s) => s.isLate).length,
          },
        };
      }),
    };
  },

  async get(ctx: RequestContext, id: string) {
    const assignment = await requireAssignment(id);
    const role = await courseRole(ctx, assignment.courseId);
    if (role !== 'student') return { ...toAssignment(assignment), myRole: role };
    const mine = await assignmentsRepository.findSubmission(ctx.db, id, ctx.user.id);
    return {
      ...toAssignment(assignment),
      myRole: role,
      status: submissionStatus(assignment, mine),
      submission: mine ? toSubmission(mine) : null,
    };
  },

  async create(
    ctx: RequestContext,
    courseId: string,
    input: Required<AssignmentInput>,
    file: UploadedFile | undefined,
  ) {
    await assertCourseStaff(ctx, courseId);
    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    if (file) {
      const verified = await verifyUpload(file, 'resources', MAX_RESOURCE_BYTES);
      attachmentPath = buildStoragePath(`${courseId}/assignments`, verified.fileName);
      attachmentName = verified.fileName;
      await storageRepository.upload(
        'resources',
        attachmentPath,
        verified.buffer,
        verified.mimeType,
      );
    }
    try {
      const assignment = await assignmentsRepository.insert(ctx.db, {
        ...input,
        courseId,
        createdBy: ctx.user.id,
        attachmentPath,
        attachmentName,
      });
      await auditRepository.record(ctx.user.id, 'assignment.create', 'assignment', assignment.id, {
        courseId,
        title: assignment.title,
      });
      return toAssignment(assignment);
    } catch (err) {
      if (attachmentPath) await storageRepository.remove('resources', [attachmentPath]);
      throw err;
    }
  },

  async update(ctx: RequestContext, id: string, input: AssignmentInput) {
    const assignment = await requireAssignment(id);
    await assertCourseStaff(ctx, assignment.courseId);
    if (input.maxMarks !== undefined) {
      const highest = await assignmentsRepository.maxGradedMarks(ctx.db, id);
      if (highest !== null && input.maxMarks < highest) {
        throw conflict(`Max marks cannot be lower than an existing grade (${highest}).`);
      }
    }
    const updated = await assignmentsRepository.update(ctx.db, id, input);
    await auditRepository.record(ctx.user.id, 'assignment.update', 'assignment', id, { ...input });
    return toAssignment(updated);
  },

  async remove(ctx: RequestContext, id: string) {
    const assignment = await requireAssignment(id);
    await assertCourseStaff(ctx, assignment.courseId);
    const submissions = await assignmentsRepository.submissionsForAssignments(supabaseAdmin, [id]);
    if (!(await assignmentsRepository.delete(ctx.db, id))) throw forbidden();
    if (assignment.attachmentPath)
      await storageRepository.remove('resources', [assignment.attachmentPath]);
    await storageRepository.remove(
      'submissions',
      submissions.map((s) => s.filePath).filter((path): path is string => Boolean(path)),
    );
    await auditRepository.record(ctx.user.id, 'assignment.delete', 'assignment', id, {
      courseId: assignment.courseId,
      title: assignment.title,
    });
  },

  async attachmentUrl(ctx: RequestContext, id: string) {
    const assignment = await requireAssignment(id);
    await courseRole(ctx, assignment.courseId);
    if (!assignment.attachmentPath || !assignment.attachmentName) throw notFound('Attachment');
    const url = await storageRepository.signedUrl(
      'resources',
      assignment.attachmentPath,
      assignment.attachmentName,
    );
    return { url, fileName: assignment.attachmentName, expiresIn: 60 };
  },

  /**
   * Create or replace the caller's submission. Lateness is decided on the
   * server clock; after the deadline it is rejected (409) unless late work is allowed.
   */
  async submit(
    ctx: RequestContext,
    assignmentId: string,
    input: { textAnswer?: string | undefined },
    file: UploadedFile | undefined,
  ): Promise<Submission & { status: SubmissionStatus }> {
    const assignment = await requireAssignment(assignmentId);
    await assertCourseStudent(ctx, assignment.courseId);

    const isLate = now() > new Date(assignment.dueAt);
    if (isLate && !assignment.allowLate) {
      throw new AppError(409, 'DEADLINE_PASSED', 'The deadline for this assignment has passed.');
    }
    if (!input.textAnswer && !file) {
      throw unprocessable('Add a written answer or attach a file.', [
        { path: 'textAnswer', message: 'Add a written answer or attach a file.' },
      ]);
    }

    const previous = await assignmentsRepository.findSubmission(ctx.db, assignmentId, ctx.user.id);
    let filePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const verified = await verifyUpload(file, 'submissions', MAX_SUBMISSION_BYTES);
      filePath = buildStoragePath(`${assignmentId}/${ctx.user.id}`, verified.fileName);
      fileName = verified.fileName;
      await storageRepository.upload('submissions', filePath, verified.buffer, verified.mimeType);
    }

    let saved: SubmissionRecord;
    try {
      saved = await assignmentsRepository.upsertSubmission(ctx.db, {
        assignmentId,
        studentId: ctx.user.id,
        textAnswer: input.textAnswer ?? null,
        filePath,
        fileName,
        isLate,
      });
    } catch (err) {
      if (filePath) await storageRepository.remove('submissions', [filePath]);
      if (err instanceof AppError && err.message.includes('deadline')) {
        throw new AppError(409, 'DEADLINE_PASSED', 'The deadline for this assignment has passed.');
      }
      throw err;
    }
    if (previous?.filePath && previous.filePath !== saved.filePath) {
      await storageRepository.remove('submissions', [previous.filePath]);
    }
    return { ...toSubmission(saved), status: submissionStatus(assignment, saved) };
  },

  /** Every enrolled student with their submission (or none) for the grading table. */
  async submissions(ctx: RequestContext, assignmentId: string) {
    const assignment = await requireAssignment(assignmentId);
    await assertCourseStaff(ctx, assignment.courseId);
    const [students, submissions] = await Promise.all([
      coursesRepository.students(ctx.db, assignment.courseId),
      assignmentsRepository.submissionsForAssignments(ctx.db, [assignmentId]),
    ]);
    const rows = students.map((student) => {
      const submission = submissions.find((s) => s.studentId === student.id) ?? null;
      return {
        student: {
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          rollNo: student.rollNo,
        },
        status: submissionStatus(assignment, submission),
        submission: submission ? toSubmission(submission) : null,
      };
    });
    return { assignment: toAssignment(assignment), rows };
  },

  async grade(
    ctx: RequestContext,
    submissionId: string,
    input: { marks: number; feedback: string | null },
  ) {
    const submission = await assignmentsRepository.findSubmissionById(supabaseAdmin, submissionId);
    if (!submission) throw notFound('Submission');
    const assignment = await requireAssignment(submission.assignmentId);
    await assertCourseStaff(ctx, assignment.courseId);

    if (input.marks > assignment.maxMarks) {
      throw unprocessable(`Marks must be between 0 and ${assignment.maxMarks}.`, [
        { path: 'marks', message: `Marks must be between 0 and ${assignment.maxMarks}.` },
      ]);
    }
    const graded = await assignmentsRepository.grade(ctx.db, submissionId, {
      ...input,
      gradedBy: ctx.user.id,
    });
    await auditRepository.record(ctx.user.id, 'submission.grade', 'submission', submissionId, {
      assignmentId: assignment.id,
      studentId: submission.studentId,
      marks: input.marks,
    });
    return toSubmission(graded);
  },

  /** Owner student or course staff. */
  async submissionFileUrl(ctx: RequestContext, submissionId: string) {
    const submission = await assignmentsRepository.findSubmissionById(supabaseAdmin, submissionId);
    if (!submission) throw notFound('Submission');
    const assignment = await requireAssignment(submission.assignmentId);
    const role = await courseRole(ctx, assignment.courseId);
    if (role === 'student' && submission.studentId !== ctx.user.id) throw notFound('Submission');
    if (!submission.filePath || !submission.fileName) throw notFound('File');
    const url = await storageRepository.signedUrl(
      'submissions',
      submission.filePath,
      submission.fileName,
    );
    return { url, fileName: submission.fileName, expiresIn: 60 };
  },
};
