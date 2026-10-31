import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatClock } from '@/components/common/Countdown';
import { ConfirmDialog } from '@/components/common/misc';
import { ErrorState, PageLoader } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { ApiError, api, errorMessage } from '@/lib/api';
import type { AttemptPayload, AttemptResult } from '@/lib/types';
import { cn, formatMarks } from '@/lib/utils';

type Answers = Record<string, string[]>;

type LoadedAttempt = AttemptPayload & { clockOffset: number };

function readSavedAnswers(attemptId: string): Answers {
  try {
    const saved = sessionStorage.getItem(`quiz-answers:${attemptId}`);
    return saved ? (JSON.parse(saved) as Answers) : {};
  } catch {
    return {};
  }
}

export function QuizRunnerPage() {
  const { quizId = '' } = useParams();
  const attempt = useQuery({
    queryKey: ['attempt', quizId],
    queryFn: async (): Promise<LoadedAttempt> => {
      const payload = await api.post<AttemptPayload>(`/quizzes/${quizId}/attempt`);
      return { ...payload, clockOffset: new Date(payload.serverTime).getTime() - Date.now() };
    },
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  if (attempt.isPending) return <PageLoader />;
  if (attempt.isError) {
    const code = attempt.error instanceof ApiError ? attempt.error.code : '';
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <ErrorState error={attempt.error} />
        {['ALREADY_ATTEMPTED', 'QUIZ_EXPIRED', 'QUIZ_NOT_OPEN'].includes(code) && (
          <Button asChild>
            <Link to={`/quizzes/${quizId}`}>Back to quiz</Link>
          </Button>
        )}
      </div>
    );
  }
  return <QuizRunner key={attempt.data.attemptId} quizId={quizId} data={attempt.data} />;
}

function QuizRunner({ quizId, data }: { quizId: string; data: LoadedAttempt }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storageKey = `quiz-answers:${data.attemptId}`;
  const [answers, setAnswers] = useState<Answers>(() => readSavedAnswers(data.attemptId));
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const autoSubmitted = useRef(false);

  // Persist answers locally so an accidental refresh doesn't lose them.
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(answers));
  }, [answers, storageKey]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const submit = useMutation({
    mutationFn: (final: Answers) =>
      api.post<AttemptResult>(`/quizzes/${quizId}/attempt/submit`, { answers: final }),
    onSuccess: () => {
      sessionStorage.removeItem(storageKey);
      void queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const remaining = new Date(data.expiresAt).getTime() - (now + data.clockOffset);
  const { mutate, isPending, isSuccess } = submit;
  const doSubmit = useCallback(() => {
    if (!isPending && !isSuccess) mutate(answers);
  }, [answers, isPending, isSuccess, mutate]);

  // Auto-submit at zero (the server allows a short grace period).
  useEffect(() => {
    if (remaining <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      doSubmit();
    }
  }, [remaining, doSubmit]);

  const questions = data.questions;
  const answeredCount = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;

  if (submit.isSuccess) {
    const r = submit.data;
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card>
          <CardContent className="space-y-5 pt-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
              <Trophy className="size-7" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your score</p>
              <p className="text-5xl font-semibold tracking-tight tabular-nums">
                {formatMarks(r.score)}
                <span className="text-2xl text-muted-foreground"> / {formatMarks(r.maxScore)}</span>
              </p>
              <p className="mt-1 text-lg font-medium">{r.percentage}%</p>
            </div>
            <Progress value={r.percentage} indicatorClassName="bg-success" />
            <p className="text-sm text-muted-foreground">
              {r.results.filter((x) => x.correct).length} of {r.results.length} questions fully
              correct.
            </p>
            <Button asChild className="w-full">
              <Link to={`/quizzes/${quizId}`}>Done</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = questions[current]!;
  const selected = answers[question.id] ?? [];
  const lowTime = remaining < 60_000;
  const choose = (optionId: string) =>
    setAnswers((prev) => {
      const existing = prev[question.id] ?? [];
      const next =
        question.type === 'mcq_multi'
          ? existing.includes(optionId)
            ? existing.filter((id) => id !== optionId)
            : [...existing, optionId]
          : [optionId];
      return { ...prev, [question.id]: next };
    });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="sticky top-16 z-10 -mx-4 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="min-w-0">
          <p className="truncate font-semibold">{data.quiz.title}</p>
          <p className="text-xs text-muted-foreground">
            {answeredCount}/{questions.length} answered
          </p>
        </div>
        <div
          role="timer"
          aria-live={lowTime ? 'assertive' : 'off'}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums',
            lowTime ? 'bg-destructive/10 text-destructive' : 'bg-muted',
          )}
        >
          <Clock className="size-4" /> {formatClock(Math.max(0, remaining))}
        </div>
      </div>

      {submit.isError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-2">
            <p>{errorMessage(submit.error)}</p>
            {submit.error instanceof ApiError &&
            ['QUIZ_EXPIRED', 'ALREADY_ATTEMPTED'].includes(submit.error.code) ? (
              <Button size="sm" variant="outline" onClick={() => navigate(`/quizzes/${quizId}`)}>
                Back to quiz
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={doSubmit}>
                Try again
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_14rem]">
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Question {current + 1} of {questions.length}
              </span>
              <span>
                {formatMarks(question.marks)} mark{question.marks === 1 ? '' : 's'} ·{' '}
                {question.type === 'mcq_multi' ? 'Select all that apply' : 'Select one'}
              </span>
            </div>
            <h2 className="text-lg leading-snug font-medium">{question.prompt}</h2>
            <fieldset className="space-y-2" aria-label="Options">
              {question.options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition hover:bg-muted/50',
                      checked && 'border-primary bg-primary/5 ring-1 ring-primary',
                    )}
                  >
                    <input
                      type={question.type === 'mcq_multi' ? 'checkbox' : 'radio'}
                      name={question.id}
                      className="size-4 accent-[var(--primary)]"
                      checked={checked}
                      onChange={() => choose(option.id)}
                    />
                    <span className="text-sm">{option.text}</span>
                  </label>
                );
              })}
            </fieldset>
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => setCurrent((c) => c - 1)}
                disabled={current === 0}
              >
                <ChevronLeft /> Previous
              </Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => setCurrent((c) => c + 1)}>
                  Next <ChevronRight />
                </Button>
              ) : (
                <Button
                  variant="brand"
                  onClick={() => setConfirmOpen(true)}
                  loading={submit.isPending}
                >
                  <Send /> Submit quiz
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-medium">Question navigator</p>
            <nav aria-label="Questions" className="grid grid-cols-5 gap-2">
              {questions.map((q, i) => {
                const answered = (answers[q.id]?.length ?? 0) > 0;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrent(i)}
                    aria-current={i === current ? 'step' : undefined}
                    aria-label={`Question ${i + 1}${answered ? ', answered' : ''}`}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-md border text-sm font-medium transition',
                      i === current && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
                      answered
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </nav>
            <Button
              className="w-full"
              variant="brand"
              onClick={() => setConfirmOpen(true)}
              loading={submit.isPending}
            >
              {!submit.isPending && <CheckCircle2 />} Finish & submit
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit your answers?"
        description={
          answeredCount < questions.length
            ? `You have ${questions.length - answeredCount} unanswered question(s). Unanswered questions score 0. You cannot change your answers after submitting.`
            : 'You have answered every question. You cannot change your answers after submitting.'
        }
        confirmLabel="Submit"
        onConfirm={doSubmit}
      />
    </div>
  );
}
