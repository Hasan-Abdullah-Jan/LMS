import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  Pencil,
  PlayCircle,
  Square,
  SquareCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { QuizStatusBadge } from '@/components/common/badges';
import { ConfirmDialog } from '@/components/common/misc';
import { PageHeader } from '@/components/common/page';
import { ErrorState, PageLoader } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, Switch } from '@/components/ui/misc';
import { useCourseQuery } from '@/features/courses/useCourse';
import { api, errorMessage } from '@/lib/api';
import type { Quiz } from '@/lib/types';
import { cn, formatDateTime, formatMarks } from '@/lib/utils';

function Facts({ quiz }: { quiz: Quiz }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Time limit</dt>
        <dd className="font-medium">{quiz.timeLimitMinutes} minutes</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Questions</dt>
        <dd className="font-medium">
          {quiz.questionCount} · {formatMarks(quiz.totalMarks)} marks
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Opens</dt>
        <dd className="font-medium">{formatDateTime(quiz.opensAt)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Closes</dt>
        <dd className="font-medium">{formatDateTime(quiz.closesAt)}</dd>
      </div>
    </dl>
  );
}

function StudentQuizView({ quiz }: { quiz: Quiz }) {
  const attempt = quiz.myAttempt;
  const submitted = Boolean(attempt?.submittedAt);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>About this quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {quiz.description && <p className="text-sm text-muted-foreground">{quiz.description}</p>}
          <Facts quiz={quiz} />
          <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-4 text-sm">
            <li>
              • You get <strong>one attempt</strong>. The timer starts when you press Start and
              keeps running if you leave.
            </li>
            <li>• The quiz submits automatically when time runs out.</li>
            <li>• Multi-select questions score only if every correct option is chosen.</li>
          </ul>
          {quiz.status === 'open' && (
            <Button asChild size="lg" variant="brand">
              <Link to={`/quizzes/${quiz.id}/take`}>
                <PlayCircle /> Start quiz
              </Link>
            </Button>
          )}
          {quiz.status === 'in_progress' && (
            <Button asChild size="lg" variant="brand">
              <Link to={`/quizzes/${quiz.id}/take`}>
                <PlayCircle /> Resume quiz
              </Link>
            </Button>
          )}
          {quiz.status === 'upcoming' && (
            <p className="text-sm text-muted-foreground">
              This quiz opens {formatDateTime(quiz.opensAt)}.
            </p>
          )}
          {quiz.status === 'missed' && (
            <p className="text-sm text-destructive">This quiz closed before you attempted it.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your result</CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <p className="text-4xl font-semibold tracking-tight tabular-nums">
                {formatMarks(attempt!.score)}
                <span className="text-lg text-muted-foreground">
                  {' '}
                  / {formatMarks(quiz.totalMarks)}
                </span>
              </p>
              <Progress
                value={quiz.totalMarks ? ((attempt!.score ?? 0) / quiz.totalMarks) * 100 : 0}
                indicatorClassName="bg-success"
              />
              <p className="text-xs text-muted-foreground">
                Submitted {formatDateTime(attempt!.submittedAt)}
              </p>
              {quiz.results && (
                <ul className="grid grid-cols-5 gap-2" aria-label="Per-question result">
                  {quiz.results.map((r, i) => (
                    <li
                      key={r.questionId}
                      className={cn(
                        'flex flex-col items-center rounded-md border py-1.5 text-xs',
                        r.correct
                          ? 'border-success/40 bg-success/10 text-success'
                          : 'border-destructive/30 bg-destructive/5 text-destructive',
                      )}
                    >
                      {r.correct ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Q{i + 1}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              Your score appears here after you submit.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StaffQuizView({ quiz }: { quiz: Quiz }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const publish = useMutation({
    mutationFn: (isPublished: boolean) => api.patch<Quiz>(`/quizzes/${quiz.id}`, { isPublished }),
    onSuccess: (q) => {
      toast.success(q.isPublished ? 'Quiz published' : 'Quiz unpublished');
      queryClient.setQueryData(['quiz', quiz.id], q);
      void queryClient.invalidateQueries({ queryKey: ['quizzes', quiz.courseId] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/quizzes/${quiz.id}`),
    onSuccess: () => {
      toast.success('Quiz deleted');
      void queryClient.invalidateQueries({ queryKey: ['quizzes', quiz.courseId] });
      navigate(`/courses/${quiz.courseId}/quizzes`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Facts quiz={quiz} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
              <Switch
                checked={quiz.isPublished}
                onCheckedChange={(v) => publish.mutate(v)}
                disabled={publish.isPending}
                aria-label="Published"
              />{' '}
              Published
            </label>
            <Button asChild variant="outline">
              <Link to={`/quizzes/${quiz.id}/results`}>
                <BarChart3 /> Results
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/quizzes/${quiz.id}/edit`}>
                <Pencil /> {quiz.hasAttempts ? 'Settings' : 'Edit'}
              </Link>
            </Button>
            {!quiz.hasAttempts && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete quiz"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="text-destructive" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4" /> Questions & answer key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {(quiz.questions ?? []).map((q, i) => (
              <li key={q.id} className="space-y-2">
                <p className="font-medium">
                  {i + 1}. {q.prompt}{' '}
                  <Badge variant="outline" className="ml-1">
                    {q.marks} marks
                  </Badge>
                </p>
                <ul className="space-y-1.5">
                  {q.options.map((o) => {
                    const correct = q.correctOptionIds?.includes(o.id);
                    const Icon =
                      q.type === 'mcq_multi'
                        ? correct
                          ? SquareCheck
                          : Square
                        : correct
                          ? CheckCircle2
                          : Circle;
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                          correct && 'border-success/50 bg-success/5 font-medium',
                        )}
                      >
                        <Icon
                          className={cn(
                            'size-4',
                            correct ? 'text-success' : 'text-muted-foreground',
                          )}
                        />{' '}
                        {o.text}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete quiz?"
        description="This quiz and its questions will be permanently deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

export function QuizDetailPage() {
  const { quizId = '' } = useParams();
  const query = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => api.get<Quiz>(`/quizzes/${quizId}`),
  });
  const course = useCourseQuery(query.data?.courseId ?? '');
  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const quiz = query.data;
  return (
    <div>
      <PageHeader
        back={{
          to: `/courses/${quiz.courseId}/quizzes`,
          label: course.data ? `${course.data.code} quizzes` : 'Back',
        }}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" /> {quiz.timeLimitMinutes}-minute quiz
          </span>
        }
        title={quiz.title}
        actions={
          quiz.status ? (
            <QuizStatusBadge status={quiz.status} />
          ) : quiz.isPublished ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="muted">Draft</Badge>
          )
        }
      />
      {quiz.myRole === 'student' ? <StudentQuizView quiz={quiz} /> : <StaffQuizView quiz={quiz} />}
    </div>
  );
}
