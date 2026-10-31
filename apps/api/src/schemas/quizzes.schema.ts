import { z } from 'zod';
import { isoDateTime, optionalText, requiredText, uuidSchema } from './common.schema.js';

export const questionTypeSchema = z.enum(['mcq_single', 'mcq_multi', 'true_false']);

const optionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid option id.'),
  text: requiredText('Option text', 1, 500),
});

const TRUE_FALSE_OPTIONS = [
  { id: 'true', text: 'True' },
  { id: 'false', text: 'False' },
];

export const questionSchema = z
  .object({
    type: questionTypeSchema,
    prompt: requiredText('Question', 1, 2000),
    options: z.array(optionSchema).max(8, 'At most 8 options per question.').default([]),
    correctOptionIds: z.array(z.string().trim().min(1)).min(1, 'Mark at least one correct option.'),
    marks: z.coerce
      .number()
      .positive('Marks must be greater than 0.')
      .max(100, 'At most 100 marks per question.')
      .multipleOf(0.01)
      .default(1),
  })
  .transform((q) => (q.type === 'true_false' ? { ...q, options: TRUE_FALSE_OPTIONS } : q))
  .superRefine((q, issue) => {
    const ids = q.options.map((o) => o.id);
    if (q.type !== 'true_false' && q.options.length < 2) {
      issue.addIssue({ code: 'custom', path: ['options'], message: 'Add at least two options.' });
    }
    if (new Set(ids).size !== ids.length) {
      issue.addIssue({ code: 'custom', path: ['options'], message: 'Option ids must be unique.' });
    }
    const correct = [...new Set(q.correctOptionIds)];
    if (correct.some((id) => !ids.includes(id))) {
      issue.addIssue({
        code: 'custom',
        path: ['correctOptionIds'],
        message: 'Correct answers must be one of the options.',
      });
    }
    if (q.type !== 'mcq_multi' && correct.length !== 1) {
      issue.addIssue({
        code: 'custom',
        path: ['correctOptionIds'],
        message: 'This question type needs exactly one correct answer.',
      });
    }
  });

export type QuestionInput = z.output<typeof questionSchema>;

const quizFields = {
  title: requiredText('Title', 1, 200),
  description: optionalText(2000),
  timeLimitMinutes: z.coerce
    .number()
    .int('Use whole minutes.')
    .min(1, 'At least 1 minute.')
    .max(600, 'At most 600 minutes.'),
  opensAt: isoDateTime('Opening time'),
  closesAt: isoDateTime('Closing time'),
  isPublished: z.boolean().default(false),
  shuffleQuestions: z.boolean().default(false),
};

export const createQuizSchema = z
  .object({
    ...quizFields,
    questions: z
      .array(questionSchema)
      .min(1, 'Add at least one question.')
      .max(100, 'At most 100 questions.'),
  })
  .refine((q) => new Date(q.closesAt) > new Date(q.opensAt), {
    path: ['closesAt'],
    message: 'The quiz must close after it opens.',
  });

export const updateQuizSchema = z
  .object({
    title: quizFields.title.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    timeLimitMinutes: quizFields.timeLimitMinutes.optional(),
    opensAt: quizFields.opensAt.optional(),
    closesAt: quizFields.closesAt.optional(),
    isPublished: z.boolean().optional(),
    shuffleQuestions: z.boolean().optional(),
    questions: z.array(questionSchema).min(1).max(100).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  })
  .refine((q) => !q.opensAt || !q.closesAt || new Date(q.closesAt) > new Date(q.opensAt), {
    path: ['closesAt'],
    message: 'The quiz must close after it opens.',
  });

export const submitAttemptSchema = z.object({
  answers: z
    .record(uuidSchema, z.array(z.string().max(20)).max(8))
    .refine((value) => Object.keys(value).length <= 100, 'Too many answers.'),
});
