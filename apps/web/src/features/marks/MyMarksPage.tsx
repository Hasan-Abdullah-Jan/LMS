import { useQuery } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import type { MyMarks } from '@/lib/types';
import { formatDate, formatMarks } from '@/lib/utils';

function percentTone(pct: number | null) {
  if (pct === null) return 'bg-muted-foreground';
  return pct >= 80
    ? 'bg-success'
    : pct >= 60
      ? 'bg-info'
      : pct >= 50
        ? 'bg-warning'
        : 'bg-destructive';
}

export function MyMarksPage() {
  const query = useQuery({ queryKey: ['my-marks'], queryFn: () => api.get<MyMarks>('/me/marks') });

  return (
    <div>
      <PageHeader
        title="My marks"
        description="Percentages count graded work only. Items awaiting grading show as Pending."
      />
      {query.isPending ? (
        <ListSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No courses yet"
          description="Marks appear once you're enrolled and your work is graded."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center">
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">Overall across all courses</p>
                <Progress
                  value={query.data.overall.percentage ?? 0}
                  indicatorClassName={percentTone(query.data.overall.percentage)}
                  className="h-3"
                />
              </div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {query.data.overall.percentage === null ? '—' : `${query.data.overall.percentage}%`}
              </p>
            </CardContent>
          </Card>
          {query.data.courses.map(({ course, items, totals }) => (
            <Card key={course.id}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle>
                  <Link to={`/courses/${course.id}`} className="hover:underline">
                    <span className="font-mono text-muted-foreground">{course.code}</span> ·{' '}
                    {course.title}
                  </Link>
                </CardTitle>
                <div className="flex w-full items-center gap-3 sm:w-64">
                  <Progress
                    value={totals.percentage ?? 0}
                    indicatorClassName={percentTone(totals.percentage)}
                  />
                  <span className="w-14 text-right font-semibold tabular-nums">
                    {totals.percentage === null ? '—' : `${totals.percentage}%`}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No submitted work yet in this course.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Graded</TableHead>
                        <TableHead className="text-right">Marks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={`${item.kind}-${item.itemId}`}>
                          <TableCell className="font-medium">
                            <Link
                              to={
                                item.kind === 'quiz'
                                  ? `/quizzes/${item.itemId}`
                                  : `/assignments/${item.itemId}`
                              }
                              className="hover:underline"
                            >
                              {item.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {item.kind}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.gradedAt && item.status === 'graded'
                              ? formatDate(item.gradedAt)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.status === 'pending' ? (
                              <Badge variant="muted">Pending</Badge>
                            ) : (
                              <span className="font-semibold">
                                {formatMarks(item.obtained)} / {formatMarks(item.max)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
                        <TableCell colSpan={3}>Total (graded items)</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {totals.max > 0
                            ? `${formatMarks(totals.obtained)} / ${formatMarks(totals.max)}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
