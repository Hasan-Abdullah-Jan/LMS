import type { Db } from '../config/supabase.js';
import { supabaseAdmin } from '../config/supabase.js';
import { unwrap, unwrapList, unwrapRequired } from '../lib/db.js';
import type { Json } from '../types/database.types.js';
import { num, type Row } from './mappers.js';

export type QuestionType = Row<'quiz_questions'>['type'];

export interface QuizOption {
  id: string;
  text: string;
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  opensAt: string;
  closesAt: string;
  isPublished: boolean;
  shuffleQuestions: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** A question as students see it: no answer key, ever. */
export interface PublicQuestion {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: QuizOption[];
  marks: number;
}

export interface Attempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  questionOrder: string[];
  answers: Record<string, string[]>;
  score: number | null;
}

export const GRACE_SECONDS = 10;

export function toQuiz(row: Row<'quizzes'>): Quiz {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    timeLimitMinutes: row.time_limit_minutes,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    isPublished: row.is_published,
    shuffleQuestions: row.shuffle_questions,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toQuestion(row: Row<'quiz_questions'>): PublicQuestion {
  return {
    id: row.id,
    position: row.position,
    type: row.type,
    prompt: row.prompt,
    options: (Array.isArray(row.options) ? row.options : []) as unknown as QuizOption[],
    marks: Number(row.marks),
  };
}

function toAttempt(row: Row<'quiz_attempts'>): Attempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    studentId: row.student_id,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    questionOrder: row.question_order,
    answers: (row.answers ?? {}) as Record<string, string[]>,
    score: num(row.score),
  };
}

export interface QuizInsert {
  courseId: string;
  createdBy: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  opensAt: string;
  closesAt: string;
  isPublished: boolean;
  shuffleQuestions: boolean;
}

export interface QuestionWithKey {
  type: QuestionType;
  prompt: string;
  options: QuizOption[];
  correctOptionIds: string[];
  marks: number;
}

export const quizzesRepository = {
  async listByCourse(db: Db, courseId: string, publishedOnly: boolean): Promise<Quiz[]> {
    let query = db.from('quizzes').select('*').eq('course_id', courseId).order('opens_at', { ascending: false }).limit(200);
    if (publishedOnly) query = query.eq('is_published', true);
    return unwrapList(await query, 'Quiz').map(toQuiz);
  },

  /** Published quizzes whose window is currently open, across courses. */
  async openForCourses(db: Db, courseIds: string[], at: string): Promise<Quiz[]> {
    if (courseIds.length === 0) return [];
    const rows = unwrapList(
      await db
        .from('quizzes')
        .select('*')
        .in('course_id', courseIds)
        .eq('is_published', true)
        .lte('opens_at', at)
        .gte('closes_at', at)
        .order('closes_at')
        .limit(50),
      'Quiz',
    );
    return rows.map(toQuiz);
  },

  async findById(db: Db, id: string): Promise<Quiz | null> {
    const row = unwrap(await db.from('quizzes').select('*').eq('id', id).maybeSingle(), 'Quiz');
    return row ? toQuiz(row) : null;
  },

  async questions(db: Db, quizId: string): Promise<PublicQuestion[]> {
    const rows = unwrapList(
      await db.from('quiz_questions').select('*').eq('quiz_id', quizId).order('position'),
      'Question',
    );
    return rows.map(toQuestion);
  },

  /** Question totals per quiz (count and marks). */
  async questionStats(db: Db, quizIds: string[]): Promise<Map<string, { count: number; totalMarks: number }>> {
    const stats = new Map<string, { count: number; totalMarks: number }>();
    if (quizIds.length === 0) return stats;
    const rows = unwrapList(
      await db.from('quiz_questions').select('quiz_id, marks').in('quiz_id', quizIds),
      'Question',
    );
    for (const row of rows) {
      const current = stats.get(row.quiz_id) ?? { count: 0, totalMarks: 0 };
      current.count += 1;
      current.totalMarks = Math.round((current.totalMarks + Number(row.marks)) * 100) / 100;
      stats.set(row.quiz_id, current);
    }
    return stats;
  },

  /** Answer key. Read with the caller's client (staff) or the service role (grading). */
  async answerKey(db: Db, quizId: string): Promise<Map<string, string[]>> {
    const rows = unwrapList(
      await db.from('quiz_answers').select('question_id, correct_option_ids, quiz_questions!inner(quiz_id)').eq('quiz_questions.quiz_id', quizId),
      'Answer key',
    );
    return new Map(rows.map((row) => [row.question_id, row.correct_option_ids]));
  },

  async insertQuiz(db: Db, input: QuizInsert): Promise<Quiz> {
    const row = unwrapRequired(
      await db
        .from('quizzes')
        .insert({
          course_id: input.courseId,
          created_by: input.createdBy,
          title: input.title,
          description: input.description,
          time_limit_minutes: input.timeLimitMinutes,
          opens_at: input.opensAt,
          closes_at: input.closesAt,
          is_published: input.isPublished,
          shuffle_questions: input.shuffleQuestions,
        })
        .select('*')
        .single(),
      'Quiz',
    );
    return toQuiz(row);
  },

  async updateQuiz(db: Db, id: string, patch: Partial<Omit<QuizInsert, 'courseId' | 'createdBy'>>): Promise<Quiz> {
    const row = unwrapRequired(
      await db
        .from('quizzes')
        .update({
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.description !== undefined && { description: patch.description }),
          ...(patch.timeLimitMinutes !== undefined && { time_limit_minutes: patch.timeLimitMinutes }),
          ...(patch.opensAt !== undefined && { opens_at: patch.opensAt }),
          ...(patch.closesAt !== undefined && { closes_at: patch.closesAt }),
          ...(patch.isPublished !== undefined && { is_published: patch.isPublished }),
          ...(patch.shuffleQuestions !== undefined && { shuffle_questions: patch.shuffleQuestions }),
        })
        .eq('id', id)
        .select('*')
        .maybeSingle(),
      'Quiz',
    );
    return toQuiz(row);
  },

  async deleteQuiz(db: Db, id: string): Promise<boolean> {
    const rows = unwrapList(await db.from('quizzes').delete().eq('id', id).select('id'), 'Quiz');
    return rows.length > 0;
  },

  /** Replace all questions and answer keys (only allowed before any attempt exists). */
  async replaceQuestions(db: Db, quizId: string, questions: QuestionWithKey[]): Promise<void> {
    unwrap(await db.from('quiz_questions').delete().eq('quiz_id', quizId), 'Question');
    const inserted = unwrapList(
      await db
        .from('quiz_questions')
        .insert(
          questions.map((q, position) => ({
            quiz_id: quizId,
            position,
            type: q.type,
            prompt: q.prompt,
            options: q.options as unknown as NonNullable<Json>,
            marks: q.marks,
          })),
        )
        .select('id, position'),
      'Question',
    );
    const byPosition = new Map(inserted.map((row) => [row.position, row.id]));
    unwrap(
      await db.from('quiz_answers').insert(
        questions.map((q, position) => ({
          question_id: byPosition.get(position)!,
          correct_option_ids: [...new Set(q.correctOptionIds)],
        })),
      ),
      'Answer key',
    );
  },

  // ---------------------------------------------------------------- attempts
  async findAttempt(db: Db, quizId: string, studentId: string): Promise<Attempt | null> {
    const row = unwrap(
      await db.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('student_id', studentId).maybeSingle(),
      'Attempt',
    );
    return row ? toAttempt(row) : null;
  },

  async attemptsForQuizzes(db: Db, quizIds: string[]): Promise<Attempt[]> {
    if (quizIds.length === 0) return [];
    const rows = unwrapList(await db.from('quiz_attempts').select('*').in('quiz_id', quizIds), 'Attempt');
    return rows.map(toAttempt);
  },

  async countAttempts(quizId: string): Promise<number> {
    const result = await supabaseAdmin
      .from('quiz_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId);
    unwrap(result, 'Attempt');
    return result.count ?? 0;
  },

  /** Attempts are written only by the server (service role) so scores can't be forged. */
  async createAttempt(input: { quizId: string; studentId: string; expiresAt: string; questionOrder: string[] }): Promise<Attempt> {
    const row = unwrapRequired(
      await supabaseAdmin
        .from('quiz_attempts')
        .insert({
          quiz_id: input.quizId,
          student_id: input.studentId,
          started_at: new Date().toISOString(),
          expires_at: input.expiresAt,
          question_order: input.questionOrder,
        })
        .select('*')
        .single(),
      'Attempt',
    );
    return toAttempt(row);
  },

  /** Finalize atomically: only succeeds if the attempt is still open. */
  async finalizeAttempt(id: string, input: { answers: Record<string, string[]>; score: number; submittedAt: string }): Promise<Attempt | null> {
    const row = unwrap(
      await supabaseAdmin
        .from('quiz_attempts')
        .update({ answers: input.answers as unknown as NonNullable<Json>, score: input.score, submitted_at: input.submittedAt })
        .eq('id', id)
        .is('submitted_at', null)
        .select('*')
        .maybeSingle(),
      'Attempt',
    );
    return row ? toAttempt(row) : null;
  },

  /** Attempts abandoned past their deadline (+ grace) are closed with a score of 0. */
  async finalizeExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - GRACE_SECONDS * 1000).toISOString();
    const expired = unwrapList(
      await supabaseAdmin.from('quiz_attempts').select('id, expires_at').is('submitted_at', null).lt('expires_at', cutoff).limit(500),
      'Attempt',
    );
    await Promise.all(
      expired.map((row) =>
        supabaseAdmin.from('quiz_attempts').update({ score: 0, submitted_at: row.expires_at }).eq('id', row.id).is('submitted_at', null),
      ),
    );
  },
};
