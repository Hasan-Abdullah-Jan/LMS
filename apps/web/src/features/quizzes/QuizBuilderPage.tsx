import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  Eye,
  Plus,
  Save,
  Square,
  SquareCheck,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FormField } from '@/components/common/misc';
import { PageHeader } from '@/components/common/page';
import { ErrorState, PageLoader } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/misc';
import { useCourseQuery } from '@/features/courses/useCourse';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { QuestionType, Quiz } from '@/lib/types';
import { cn, fromLocalInput, toLocalInput } from '@/lib/utils';

interface DraftQuestion {
  key: string;
  type: QuestionType;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctOptionIds: string[];
  marks: string;
}

const LETTERS = 'abcdefgh';
const TYPE_LABEL: Record<QuestionType, string> = {
  mcq_single: 'Multiple choice (one answer)',
  mcq_multi: 'Multiple choice (several answers)',
  true_false: 'True / False',
};
const newKey = () => Math.random().toString(36).slice(2);

function blankQuestion(type: QuestionType = 'mcq_single'): DraftQuestion {
  return type === 'true_false'
    ? {
        key: newKey(),
        type,
        prompt: '',
        options: [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' },
        ],
        correctOptionIds: ['true'],
        marks: '1',
      }
    : {
        key: newKey(),
        type,
        prompt: '',
        options: [
          { id: 'a', text: '' },
          { id: 'b', text: '' },
          { id: 'c', text: '' },
          { id: 'd', text: '' },
        ],
        correctOptionIds: [],
        marks: '1',
      };
}

function validateQuestions(questions: DraftQuestion[]): string | null {
  if (questions.length === 0) return 'Add at least one question.';
  for (const [i, q] of questions.entries()) {
    const n = `Question ${i + 1}`;
    if (!q.prompt.trim()) return `${n}: write the question.`;
    if (q.options.some((o) => !o.text.trim()))
      return `${n}: fill in every option or remove empty ones.`;
    if (q.options.length < 2) return `${n}: add at least two options.`;
    if (q.correctOptionIds.length === 0) return `${n}: mark the correct answer.`;
    if (q.type !== 'mcq_multi' && q.correctOptionIds.length !== 1)
      return `${n}: choose exactly one correct answer.`;
    if (!(Number(q.marks) > 0)) return `${n}: marks must be greater than 0.`;
  }
  return null;
}

function toDraft(quiz: Quiz): DraftQuestion[] {
  return (quiz.questions ?? []).map((question) => ({
    key: question.id,
    type: question.type,
    prompt: question.prompt,
    options: question.options,
    correctOptionIds: question.correctOptionIds ?? [],
    marks: String(question.marks),
  }));
}

export function QuizBuilderPage() {
  const { courseId: routeCourseId, quizId } = useParams();
  const existing = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => api.get<Quiz>(`/quizzes/${quizId}`),
    enabled: Boolean(quizId),
  });
  if (quizId && existing.isPending) return <PageLoader />;
  if (existing.isError) return <ErrorState error={existing.error} />;
  const courseId = routeCourseId ?? existing.data?.courseId ?? '';
  return (
    <QuizBuilderForm key={existing.data?.id ?? 'new'} courseId={courseId} quiz={existing.data} />
  );
}

function QuizBuilderForm({ courseId, quiz }: { courseId: string; quiz?: Quiz }) {
  const quizId = quiz?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const course = useCourseQuery(courseId);

  const [title, setTitle] = useState(quiz?.title ?? '');
  const [description, setDescription] = useState(quiz?.description ?? '');
  const [timeLimit, setTimeLimit] = useState(String(quiz?.timeLimitMinutes ?? 15));
  const [opensAt, setOpensAt] = useState(() =>
    toLocalInput(quiz?.opensAt ?? new Date(Date.now() + 3600_000)),
  );
  const [closesAt, setClosesAt] = useState(() =>
    toLocalInput(quiz?.closesAt ?? new Date(Date.now() + 7 * 86400_000)),
  );
  const [isPublished, setIsPublished] = useState(quiz?.isPublished ?? false);
  const [shuffle, setShuffle] = useState(quiz?.shuffleQuestions ?? false);
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    quiz ? toDraft(quiz) : [blankQuestion()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const locked = Boolean(quiz?.hasAttempts);

  const update = (key: string, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const move = (index: number, delta: number) =>
    setQuestions((qs) => {
      const next = [...qs];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item!);
      return next;
    });
  const toggleCorrect = (q: DraftQuestion, optionId: string) => {
    if (q.type === 'mcq_multi') {
      update(q.key, {
        correctOptionIds: q.correctOptionIds.includes(optionId)
          ? q.correctOptionIds.filter((id) => id !== optionId)
          : [...q.correctOptionIds, optionId],
      });
    } else update(q.key, { correctOptionIds: [optionId] });
  };
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Give the quiz a title.');
    if (!(Number(timeLimit) >= 1)) return setError('Time limit must be at least 1 minute.');
    if (new Date(closesAt) <= new Date(opensAt))
      return setError('The closing time must be after the opening time.');
    const problem = locked ? null : validateQuestions(questions);
    if (problem) return setError(problem);

    const payload = locked
      ? { isPublished }
      : {
          title: title.trim(),
          description: description.trim() || (quizId ? null : undefined),
          timeLimitMinutes: Number(timeLimit),
          opensAt: fromLocalInput(opensAt),
          closesAt: fromLocalInput(closesAt),
          isPublished,
          shuffleQuestions: shuffle,
          questions: questions.map((q) => ({
            type: q.type,
            prompt: q.prompt.trim(),
            options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
            correctOptionIds: q.correctOptionIds,
            marks: Number(q.marks),
          })),
        };
    setSaving(true);
    try {
      const saved = quizId
        ? await api.patch<Quiz>(`/quizzes/${quizId}`, payload)
        : await api.post<Quiz>(`/courses/${courseId}/quizzes`, payload);
      toast.success(quizId ? 'Quiz saved' : 'Quiz created');
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      void queryClient.invalidateQueries({ queryKey: ['quiz', saved.id] });
      navigate(`/quizzes/${saved.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.details.length
          ? `${err.message} ${err.details.map((d) => d.message).join(' ')}`
          : errorMessage(err),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <PageHeader
        back={{ to: quizId ? `/quizzes/${quizId}` : `/courses/${courseId}/quizzes`, label: 'Back' }}
        eyebrow={course.data ? `${course.data.code} · ${course.data.title}` : undefined}
        title={quizId ? 'Edit quiz' : 'New quiz'}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreview(true)}
              disabled={locked}
            >
              <Eye /> Preview
            </Button>
            <Button type="submit" loading={saving}>
              {!saving && <Save />} Save quiz
            </Button>
          </>
        }
      />
      {locked && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Students have already attempted this quiz, so its questions and settings are locked. You
          can still publish or unpublish it.
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField id="q-title" label="Title" required className="md:col-span-2">
            <Input
              id="q-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={locked}
              maxLength={200}
            />
          </FormField>
          <FormField id="q-desc" label="Description" className="md:col-span-2">
            <Textarea
              id="q-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={locked}
              maxLength={2000}
            />
          </FormField>
          <FormField id="q-limit" label="Time limit (minutes)" required>
            <Input
              id="q-limit"
              type="number"
              min={1}
              max={600}
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              disabled={locked}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="q-open" label="Opens" required>
              <Input
                id="q-open"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                disabled={locked}
              />
            </FormField>
            <FormField id="q-close" label="Closes" required>
              <Input
                id="q-close"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                disabled={locked}
              />
            </FormField>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="text-sm font-medium">Published</span>
              <span className="block text-xs text-muted-foreground">
                Visible to enrolled students during the window
              </span>
            </span>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} aria-label="Published" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="text-sm font-medium">Shuffle questions</span>
              <span className="block text-xs text-muted-foreground">
                Each student gets their own order
              </span>
            </span>
            <Switch
              checked={shuffle}
              onCheckedChange={setShuffle}
              disabled={locked}
              aria-label="Shuffle questions"
            />
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          Questions{' '}
          <span className="text-muted-foreground">
            ({questions.length} · {totalMarks} marks)
          </span>
        </h2>
      </div>
      <ol className="space-y-4">
        {questions.map((q, index) => (
          <li key={q.key}>
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Q{index + 1}</Badge>
                  <NativeSelect
                    aria-label={`Question ${index + 1} type`}
                    className="h-9 w-auto"
                    value={q.type}
                    disabled={locked}
                    onChange={(e) => {
                      const type = e.target.value as QuestionType;
                      update(q.key, {
                        ...blankQuestion(type),
                        key: q.key,
                        prompt: q.prompt,
                        marks: q.marks,
                      });
                    }}
                  >
                    {Object.entries(TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={`marks-${q.key}`} className="text-xs text-muted-foreground">
                      Marks
                    </Label>
                    <Input
                      id={`marks-${q.key}`}
                      type="number"
                      min={0.25}
                      step={0.25}
                      className="h-9 w-20"
                      value={q.marks}
                      onChange={(e) => update(q.key, { marks: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="ml-auto flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move up"
                      disabled={locked || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move down"
                      disabled={locked || index === questions.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove question"
                      disabled={locked || questions.length === 1}
                      onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  aria-label={`Question ${index + 1} prompt`}
                  rows={2}
                  placeholder="Write the question…"
                  value={q.prompt}
                  onChange={(e) => update(q.key, { prompt: e.target.value })}
                  disabled={locked}
                />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {q.type === 'mcq_multi'
                      ? 'Tick every correct option (all must be chosen to earn the marks).'
                      : 'Select the correct option.'}
                  </p>
                  {q.options.map((option, oi) => {
                    const correct = q.correctOptionIds.includes(option.id);
                    const Icon =
                      q.type === 'mcq_multi'
                        ? correct
                          ? SquareCheck
                          : Square
                        : correct
                          ? CheckCircle2
                          : Circle;
                    return (
                      <div
                        key={option.id}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-1.5 pl-2',
                          correct && 'border-success/50 bg-success/5',
                        )}
                      >
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => toggleCorrect(q, option.id)}
                          aria-pressed={correct}
                          aria-label={`Mark option ${oi + 1} correct`}
                          className={cn(
                            'rounded p-1',
                            correct
                              ? 'text-success'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <Icon className="size-5" />
                        </button>
                        {q.type === 'true_false' ? (
                          <span className="flex-1 py-1.5 text-sm">{option.text}</span>
                        ) : (
                          <Input
                            aria-label={`Option ${oi + 1}`}
                            className="h-9 flex-1 border-0 shadow-none focus-visible:ring-0"
                            placeholder={`Option ${LETTERS[oi]?.toUpperCase()}`}
                            value={option.text}
                            disabled={locked}
                            onChange={(e) =>
                              update(q.key, {
                                options: q.options.map((o) =>
                                  o.id === option.id ? { ...o, text: e.target.value } : o,
                                ),
                              })
                            }
                          />
                        )}
                        {q.type !== 'true_false' && q.options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove option ${oi + 1}`}
                            disabled={locked}
                            onClick={() =>
                              update(q.key, {
                                options: q.options.filter((o) => o.id !== option.id),
                                correctOptionIds: q.correctOptionIds.filter(
                                  (id) => id !== option.id,
                                ),
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {q.type !== 'true_false' && q.options.length < 8 && !locked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const id = [...LETTERS].find((l) => !q.options.some((o) => o.id === l))!;
                        update(q.key, { options: [...q.options, { id, text: '' }] });
                      }}
                    >
                      <Plus /> Add option
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuestions((qs) => [...qs, blankQuestion('mcq_single')])}
          >
            <Plus /> Multiple choice
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuestions((qs) => [...qs, blankQuestion('mcq_multi')])}
          >
            <Plus /> Multi-select
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuestions((qs) => [...qs, blankQuestion('true_false')])}
          >
            <Plus /> True / False
          </Button>
        </div>
      )}

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student preview · {title || 'Untitled quiz'}</DialogTitle>
          </DialogHeader>
          <ol className="space-y-5">
            {questions.map((q, i) => (
              <li key={q.key} className="space-y-2">
                <p className="font-medium">
                  {i + 1}.{' '}
                  {q.prompt || (
                    <span className="text-muted-foreground italic">No question text</span>
                  )}{' '}
                  <span className="text-xs text-muted-foreground">({q.marks} marks)</span>
                </p>
                <ul className="space-y-1.5">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      {q.type === 'mcq_multi' ? (
                        <Square className="size-4 text-muted-foreground" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      {o.text || <span className="text-muted-foreground italic">Empty option</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </form>
  );
}
