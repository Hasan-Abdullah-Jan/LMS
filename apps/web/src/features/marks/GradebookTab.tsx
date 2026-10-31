import { useQuery } from '@tanstack/react-query';
import { Download, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { useCourse } from '@/features/courses/useCourse';
import { api, downloadFile, errorMessage } from '@/lib/api';
import type { Gradebook } from '@/lib/types';
import { cn, formatMarks } from '@/lib/utils';

export function GradebookTab() {
  const course = useCourse();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const query = useQuery({
    queryKey: ['gradebook', course.id],
    queryFn: () => api.get<Gradebook>(`/courses/${course.id}/gradebook`),
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(`/courses/${course.id}/gradebook.csv`, `${course.code}-gradebook.csv`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  if (query.isPending) return <ListSkeleton rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { items, rows } = query.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Click an assignment cell to open grading. Totals include graded items only.
        </p>
        <Button variant="outline" onClick={() => void exportCsv()} loading={exporting}>
          {!exporting && <Download />} Export CSV
        </Button>
      </div>
      {rows.length === 0 || items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={rows.length === 0 ? 'No students enrolled' : 'Nothing to grade yet'}
          description="The gradebook fills in as assignments and quizzes are added and graded."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-48 border-b bg-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Student
                </th>
                {items.map((item) => (
                  <th
                    key={item.id}
                    scope="col"
                    className="min-w-28 border-b bg-muted/60 px-3 py-2.5 text-center text-xs font-semibold"
                  >
                    <span className="line-clamp-2" title={item.title}>
                      {item.title}
                    </span>
                    <span className="block font-normal text-muted-foreground">
                      {item.kind} · /{formatMarks(item.max)}
                    </span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="min-w-28 border-b bg-muted/60 px-3 py-2.5 text-center text-xs font-semibold"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="min-w-20 border-b bg-muted/60 px-3 py-2.5 text-center text-xs font-semibold"
                >
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student.id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b bg-card px-3 py-2.5 text-left font-medium group-hover:bg-muted"
                  >
                    {row.student.fullName}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.student.rollNo}
                    </span>
                  </th>
                  {items.map((item) => {
                    const cell = row.cells[item.id];
                    const clickable = item.kind === 'assignment';
                    const content =
                      !cell || cell.status === 'missing' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : cell.status === 'pending' ? (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs font-medium">
                          Pending
                        </span>
                      ) : (
                        <span className="font-medium tabular-nums">
                          {formatMarks(cell.obtained)}
                        </span>
                      );
                    return (
                      <td
                        key={item.id}
                        className="border-b p-0 text-center group-hover:bg-muted/40"
                      >
                        {clickable ? (
                          <button
                            className={cn(
                              'h-full w-full px-3 py-2.5 transition hover:bg-primary/10 focus-visible:bg-primary/10',
                            )}
                            onClick={() =>
                              navigate(
                                `/assignments/${item.id}${cell?.sourceId ? `#submission-${cell.sourceId}` : ''}`,
                              )
                            }
                            aria-label={`${row.student.fullName}, ${item.title}: open grading`}
                          >
                            {content}
                          </button>
                        ) : (
                          <div className="px-3 py-2.5">{content}</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b px-3 py-2.5 text-center font-semibold tabular-nums group-hover:bg-muted/40">
                    {row.totals.max > 0
                      ? `${formatMarks(row.totals.obtained)} / ${formatMarks(row.totals.max)}`
                      : '—'}
                  </td>
                  <td className="border-b px-3 py-2.5 text-center font-semibold tabular-nums group-hover:bg-muted/40">
                    {row.totals.percentage === null ? '—' : `${row.totals.percentage}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
