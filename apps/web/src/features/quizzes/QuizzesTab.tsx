import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Clock, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QuizStatusBadge } from '@/components/common/badges';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCourse } from '@/features/courses/useCourse';
import { api } from '@/lib/api';
import { isStaff } from '@/lib/roles';
import type { Quiz } from '@/lib/types';
import { formatDateTime, formatMarks } from '@/lib/utils';

export function QuizzesTab() {
  const course = useCourse();
  const staff = isStaff(course.myRole);
  const query = useQuery({
    queryKey: ['quizzes', course.id],
    queryFn: () => api.page<Quiz>(`/courses/${course.id}/quizzes`),
  });

  return (
    <div className="space-y-4">
      {staff && (
        <div className="flex justify-end">
          <Button asChild>
            <Link to={`/courses/${course.id}/quizzes/new`}>
              <Plus /> New quiz
            </Link>
          </Button>
        </div>
      )}
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No quizzes yet"
          description={
            staff
              ? 'Build a timed quiz with MCQ and true/false questions.'
              : 'No quizzes have been published yet.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {query.data.data.map((q) => (
            <li
              key={q.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:p-5"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/quizzes/${q.id}`} className="font-semibold hover:underline">
                    {q.title}
                  </Link>
                  {q.status && <QuizStatusBadge status={q.status} />}
                  {staff &&
                    (q.isPublished ? (
                      <Badge variant="success">Published</Badge>
                    ) : (
                      <Badge variant="muted">Draft</Badge>
                    ))}
                </div>
                <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-4" /> {q.timeLimitMinutes} min
                  </span>
                  <span>
                    {q.questionCount} questions · {formatMarks(q.totalMarks)} marks
                  </span>
                  <span>
                    {formatDateTime(q.opensAt)} → {formatDateTime(q.closesAt)}
                  </span>
                </p>
              </div>
              {q.myAttempt?.submittedAt && (
                <div className="text-right text-sm">
                  <p className="font-semibold tabular-nums">
                    {formatMarks(q.myAttempt.score)} / {formatMarks(q.totalMarks)}
                  </p>
                  <p className="text-xs text-muted-foreground">Your score</p>
                </div>
              )}
              {q.stats && (
                <p className="text-sm text-muted-foreground">
                  {q.stats.submitted}/{q.stats.enrolled} completed
                </p>
              )}
              <div className="flex gap-2">
                {staff ? (
                  <>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/quizzes/${q.id}`}>Manage</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/quizzes/${q.id}/results`}>Results</Link>
                    </Button>
                  </>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    variant={
                      q.status === 'open' || q.status === 'in_progress' ? 'brand' : 'outline'
                    }
                  >
                    <Link to={`/quizzes/${q.id}`}>
                      {q.status === 'open'
                        ? 'Start'
                        : q.status === 'in_progress'
                          ? 'Resume'
                          : 'View'}
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
