import { supabaseAdmin } from '../config/supabase.js';
import { AppError, conflict, forbidden, notFound } from '../lib/errors.js';
import { gradeAttempt, seededShuffle } from '../lib/quiz-grading.js';
import { now } from '../lib/time.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { coursesRepository } from '../repositories/courses.repository.js';
import {
  GRACE_SECONDS,
  quizzesRepository,
  type Attempt,
  type PublicQuestion,
  type Quiz,
} from '../repositories/quizzes.repository.js';
import type { QuestionInput } from '../schemas/quizzes.schema.js';
import type { RequestContext } from '../types/auth.js';
import { assertCourseStaff, assertCourseStudent, courseRole } from './access.service.js';

export type StudentQuizStatus =
  'upcoming' | 'open' | 'in_progress' | 'submitted' | 'missed' | 'closed';

export interface QuizInput {
  title: string;
  description?: string | undefined;
  timeLimitMinutes: number;
  opensAt: string;
  closesAt: string;
  isPublished: boolean;
  shuffleQuestions: boolean;
  questions: QuestionInput[];
}

export interface QuizPatch {
  title?: string | undefined;
  description?: string | null | undefined;
  timeLimitMinutes?: number | undefined;
  opensAt?: string | undefined;
  closesAt?: string | undefined;
  isPublished?: boolean | undefined;
  shuffleQuestions?: boolean | undefined;
  questions?: QuestionInput[] | undefined;
}

function studentStatus(quiz: Quiz, attempt: Attempt | null, at = now()): StudentQuizStatus {
  if (attempt?.submittedAt) return 'submitted';
  if (attempt && at.getTime() <= new Date(attempt.expiresAt).getTime() + GRACE_SECONDS * 1000)
    return 'in_progress';
  if (attempt) return 'submitted';
  if (at < new Date(quiz.opensAt)) return 'upcoming';
  if (at > new Date(quiz.closesAt)) return 'missed';
  return 'open';
}

async function requireQuiz(id: string): Promise<Quiz> {
  const quiz = await quizzesRepository.findById(supabaseAdmin, id);
  if (!quiz) throw notFound('Quiz');
  return quiz;
}

function orderQuestions(questions: PublicQuestion[], order: string[]): PublicQuestion[] {
  if (order.length === 0) return questions;
  const byId = new Map(questions.map((q) => [q.id, q]));
  return order.map((id) => byId.get(id)).filter((q): q is PublicQuestion => Boolean(q));
}

function attemptPayload(quiz: Quiz, attempt: Attempt, questions: PublicQuestion[]) {
  return {
    attemptId: attempt.id,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimitMinutes: quiz.timeLimitMinutes,
    },
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    serverTime: now().toISOString(),
    graceSeconds: GRACE_SECONDS,
    // Public projection only: id, type, prompt, options, marks. Never the answer key.
    questions: orderQuestions(questions, attempt.questionOrder).map(
      ({ id, type, prompt, options, marks }) => ({
        id,
        type,
        prompt,
        options,
        marks,
      }),
    ),
  };
}

export const quizzesService = {
  async list(ctx: RequestContext, courseId: string) {
    const role = await courseRole(ctx, courseId);
    await quizzesRepository.finalizeExpired();
    const quizzes = await quizzesRepository.listByCourse(ctx.db, courseId, role === 'student');
    const ids = quizzes.map((q) => q.id);
    const [stats, attempts] = await Promise.all([
      quizzesRepository.questionStats(supabaseAdmin, ids),
      quizzesRepository.attemptsForQuizzes(ctx.db, ids),
    ]);

    if (role === 'student') {
      return quizzes.map((quiz) => {
        const mine =
          attempts.find((a) => a.quizId === quiz.id && a.studentId === ctx.user.id) ?? null;
        return {
          ...quiz,
          questionCount: stats.get(quiz.id)?.count ?? 0,
          totalMarks: stats.get(quiz.id)?.totalMarks ?? 0,
          status: studentStatus(quiz, mine),
          myAttempt: mine
            ? {
                startedAt: mine.startedAt,
                expiresAt: mine.expiresAt,
                submittedAt: mine.submittedAt,
                score: mine.score,
              }
            : null,
        };
      });
    }

    const enrolled = (await coursesRepository.enrolledStudentIds(ctx.db, courseId)).length;
    return quizzes.map((quiz) => {
      const forQuiz = attempts.filter((a) => a.quizId === quiz.id);
      return {
        ...quiz,
        questionCount: stats.get(quiz.id)?.count ?? 0,
        totalMarks: stats.get(quiz.id)?.totalMarks ?? 0,
        stats: {
          enrolled,
          attempts: forQuiz.length,
          submitted: forQuiz.filter((a) => a.submittedAt).length,
        },
      };
    });
  },

  /** Staff: full quiz with answer key (for the builder). Students: metadata + own result. */
  async get(ctx: RequestContext, id: string) {
    const quiz = await requireQuiz(id);
    const role = await courseRole(ctx, quiz.courseId);
    const stats = (await quizzesRepository.questionStats(supabaseAdmin, [id])).get(id);

    if (role === 'student') {
      if (!quiz.isPublished) throw notFound('Quiz');
      const attempt = await quizzesRepository.findAttempt(ctx.db, id, ctx.user.id);
      let results:
        Array<{ questionId: string; correct: boolean; marksAwarded: number }> | undefined;
      if (attempt?.submittedAt) {
        const [questions, key] = await Promise.all([
          quizzesRepository.questions(supabaseAdmin, id),
          quizzesRepository.answerKey(supabaseAdmin, id),
        ]);
        results = gradeAttempt(questions, key, attempt.answers).results;
      }
      return {
        ...quiz,
        myRole: role,
        questionCount: stats?.count ?? 0,
        totalMarks: stats?.totalMarks ?? 0,
        status: studentStatus(quiz, attempt),
        myAttempt: attempt
          ? {
              startedAt: attempt.startedAt,
              expiresAt: attempt.expiresAt,
              submittedAt: attempt.submittedAt,
              score: attempt.score,
            }
          : null,
        // Only correctness per question - never which option was right.
        results,
      };
    }

    const [questions, key, attempts] = await Promise.all([
      quizzesRepository.questions(ctx.db, id),
      quizzesRepository.answerKey(ctx.db, id),
      quizzesRepository.countAttempts(id),
    ]);
    return {
      ...quiz,
      myRole: role,
      questionCount: stats?.count ?? 0,
      totalMarks: stats?.totalMarks ?? 0,
      hasAttempts: attempts > 0,
      questions: questions.map((q) => ({ ...q, correctOptionIds: key.get(q.id) ?? [] })),
    };
  },

  async create(ctx: RequestContext, courseId: string, input: QuizInput) {
    await assertCourseStaff(ctx, courseId);
    const quiz = await quizzesRepository.insertQuiz(ctx.db, {
      courseId,
      createdBy: ctx.user.id,
      title: input.title,
      description: input.description ?? null,
      timeLimitMinutes: input.timeLimitMinutes,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      isPublished: input.isPublished,
      shuffleQuestions: input.shuffleQuestions,
    });
    try {
      await quizzesRepository.replaceQuestions(ctx.db, quiz.id, input.questions);
    } catch (err) {
      await quizzesRepository.deleteQuiz(ctx.db, quiz.id);
      throw err;
    }
    await auditRepository.record(ctx.user.id, 'quiz.create', 'quiz', quiz.id, {
      courseId,
      title: quiz.title,
    });
    return this.get(ctx, quiz.id);
  },

  /** Editing is blocked once any attempt exists; publishing can always be toggled. */
  async update(ctx: RequestContext, id: string, patch: QuizPatch) {
    const quiz = await requireQuiz(id);
    await assertCourseStaff(ctx, quiz.courseId);

    const { isPublished, questions, ...rest } = patch;
    const editsContent =
      questions !== undefined || Object.values(rest).some((v) => v !== undefined);
    if (editsContent && (await quizzesRepository.countAttempts(id)) > 0) {
      throw new AppError(
        409,
        'QUIZ_LOCKED',
        'Students have already attempted this quiz, so it can no longer be edited. You can still publish or unpublish it.',
      );
    }
    const opensAt = rest.opensAt ?? quiz.opensAt;
    const closesAt = rest.closesAt ?? quiz.closesAt;
    if (new Date(closesAt) <= new Date(opensAt)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'The quiz must close after it opens.', [
        { path: 'closesAt', message: 'The quiz must close after it opens.' },
      ]);
    }

    await quizzesRepository.updateQuiz(ctx.db, id, { ...rest, isPublished });
    if (questions) await quizzesRepository.replaceQuestions(ctx.db, id, questions);
    await auditRepository.record(ctx.user.id, 'quiz.update', 'quiz', id, {
      ...(isPublished !== undefined && { isPublished }),
      contentEdited: editsContent,
    });
    return this.get(ctx, id);
  },

  async remove(ctx: RequestContext, id: string) {
    const quiz = await requireQuiz(id);
    await assertCourseStaff(ctx, quiz.courseId);
    if ((await quizzesRepository.countAttempts(id)) > 0) {
      throw new AppError(
        409,
        'QUIZ_LOCKED',
        'This quiz has attempts and cannot be deleted. Unpublish it instead.',
      );
    }
    if (!(await quizzesRepository.deleteQuiz(ctx.db, id))) throw forbidden();
    await auditRepository.record(ctx.user.id, 'quiz.delete', 'quiz', id, { title: quiz.title });
  },

  /** Start (or resume) the single attempt. Returns questions WITHOUT answers. */
  async startAttempt(ctx: RequestContext, id: string) {
    const quiz = await requireQuiz(id);
    await assertCourseStudent(ctx, quiz.courseId);
    if (!quiz.isPublished) throw notFound('Quiz');

    const current = now();
    const existing = await quizzesRepository.findAttempt(ctx.db, id, ctx.user.id);
    if (existing) {
      if (existing.submittedAt)
        throw conflict('You have already attempted this quiz.', 'ALREADY_ATTEMPTED');
      if (current.getTime() > new Date(existing.expiresAt).getTime() + GRACE_SECONDS * 1000) {
        await quizzesRepository.finalizeAttempt(existing.id, {
          answers: {},
          score: 0,
          submittedAt: existing.expiresAt,
        });
        throw conflict('Your time for this quiz has run out.', 'QUIZ_EXPIRED');
      }
      const questions = await quizzesRepository.questions(supabaseAdmin, id);
      return attemptPayload(quiz, existing, questions);
    }

    if (current < new Date(quiz.opensAt))
      throw conflict('This quiz has not opened yet.', 'QUIZ_NOT_OPEN');
    if (current > new Date(quiz.closesAt)) throw conflict('This quiz has closed.', 'QUIZ_NOT_OPEN');

    const questions = await quizzesRepository.questions(supabaseAdmin, id);
    if (questions.length === 0) throw conflict('This quiz has no questions yet.', 'QUIZ_NOT_OPEN');

    const limitEnd = current.getTime() + quiz.timeLimitMinutes * 60_000;
    const expiresAt = new Date(Math.min(limitEnd, new Date(quiz.closesAt).getTime())).toISOString();
    const order = quiz.shuffleQuestions
      ? seededShuffle(
          questions.map((q) => q.id),
          `${id}:${ctx.user.id}`,
        )
      : questions.map((q) => q.id);

    let attempt: Attempt;
    try {
      attempt = await quizzesRepository.createAttempt({
        quizId: id,
        studentId: ctx.user.id,
        expiresAt,
        questionOrder: order,
      });
    } catch (err) {
      if (err instanceof AppError && err.status === 409) {
        throw conflict('You have already attempted this quiz.', 'ALREADY_ATTEMPTED');
      }
      throw err;
    }
    return attemptPayload(quiz, attempt, questions);
  },

  /** Grade on the server against quiz_answers. Late submissions are rejected and scored 0. */
  async submitAttempt(ctx: RequestContext, id: string, answers: Record<string, string[]>) {
    const quiz = await requireQuiz(id);
    await assertCourseStudent(ctx, quiz.courseId);

    const attempt = await quizzesRepository.findAttempt(ctx.db, id, ctx.user.id);
    if (!attempt) throw conflict('Start the quiz before submitting.', 'QUIZ_NOT_OPEN');
    if (attempt.submittedAt)
      throw conflict('You have already submitted this quiz.', 'ALREADY_ATTEMPTED');

    const current = now();
    if (current.getTime() > new Date(attempt.expiresAt).getTime() + GRACE_SECONDS * 1000) {
      await quizzesRepository.finalizeAttempt(attempt.id, {
        answers: {},
        score: 0,
        submittedAt: attempt.expiresAt,
      });
      throw conflict(
        'Time is up: this submission arrived after the time limit and was scored 0.',
        'QUIZ_EXPIRED',
      );
    }

    const [questions, key] = await Promise.all([
      quizzesRepository.questions(supabaseAdmin, id),
      quizzesRepository.answerKey(supabaseAdmin, id),
    ]);
    // Keep only answers to this quiz's questions, using that question's option ids.
    const cleaned: Record<string, string[]> = {};
    for (const question of questions) {
      const given = answers[question.id];
      if (!given) continue;
      const valid = [...new Set(given)].filter((optionId) =>
        question.options.some((o) => o.id === optionId),
      );
      if (valid.length > 0)
        cleaned[question.id] = question.type === 'mcq_multi' ? valid : valid.slice(0, 1);
    }

    const { score, results } = gradeAttempt(questions, key, cleaned);
    const saved = await quizzesRepository.finalizeAttempt(attempt.id, {
      answers: cleaned,
      score,
      submittedAt: current.toISOString(),
    });
    if (!saved) throw conflict('You have already submitted this quiz.', 'ALREADY_ATTEMPTED');

    const maxScore = Math.round(questions.reduce((sum, q) => sum + q.marks, 0) * 100) / 100;
    return {
      score,
      maxScore,
      percentage: maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0,
      submittedAt: saved.submittedAt,
      results,
    };
  },

  /** All attempts and scores for the course's students (staff). */
  async results(ctx: RequestContext, id: string) {
    const quiz = await requireQuiz(id);
    await assertCourseStaff(ctx, quiz.courseId);
    await quizzesRepository.finalizeExpired();
    const [students, attempts, stats] = await Promise.all([
      coursesRepository.students(ctx.db, quiz.courseId),
      quizzesRepository.attemptsForQuizzes(ctx.db, [id]),
      quizzesRepository.questionStats(supabaseAdmin, [id]),
    ]);
    const totalMarks = stats.get(id)?.totalMarks ?? 0;
    const rows = students.map((student) => {
      const attempt = attempts.find((a) => a.studentId === student.id) ?? null;
      return {
        student: {
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          rollNo: student.rollNo,
        },
        status: attempt?.submittedAt ? 'submitted' : attempt ? 'in_progress' : 'not_attempted',
        startedAt: attempt?.startedAt ?? null,
        submittedAt: attempt?.submittedAt ?? null,
        score: attempt?.score ?? null,
      };
    });
    const scores = rows.map((r) => r.score).filter((s): s is number => s !== null);
    return {
      quiz: { ...quiz, totalMarks },
      summary: {
        submitted: scores.length,
        average: scores.length
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
          : null,
        highest: scores.length ? Math.max(...scores) : null,
      },
      rows,
    };
  },
};
