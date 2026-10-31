import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, MoreHorizontal, Pencil, PenSquare, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { SubmissionStatusBadge } from '@/components/common/badges';
import { DueCountdown } from '@/components/common/Countdown';
import { ConfirmDialog } from '@/components/common/misc';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/misc';
import { useCourse } from '@/features/courses/useCourse';
import { api, errorMessage } from '@/lib/api';
import { isStaff } from '@/lib/roles';
import type { Assignment } from '@/lib/types';
import { formatDateTime, formatMarks } from '@/lib/utils';
import { AssignmentFormDialog } from './AssignmentFormDialog';

export function AssignmentsTab() {
  const course = useCourse();
  const staff = isStaff(course.myRole);
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | undefined>();
  const [toDelete, setToDelete] = useState<Assignment | null>(null);

  const query = useQuery({
    queryKey: ['assignments', course.id],
    queryFn: () => api.page<Assignment>(`/courses/${course.id}/assignments`, { pageSize: 100 }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/assignments/${id}`),
    onSuccess: () => {
      toast.success('Assignment deleted');
      void queryClient.invalidateQueries({ queryKey: ['assignments', course.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      {staff && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus /> New assignment
          </Button>
        </div>
      )}
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          icon={PenSquare}
          title="No assignments yet"
          description={
            staff
              ? 'Create the first assignment for this course.'
              : 'Nothing has been assigned yet.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {query.data.data.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border bg-card p-4 shadow-xs transition hover:shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/assignments/${a.id}`} className="font-semibold hover:underline">
                      {a.title}
                    </Link>
                    {a.status && <SubmissionStatusBadge status={a.status} />}
                    {a.allowLate && <Badge variant="outline">Late allowed</Badge>}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="size-4" /> {formatDateTime(a.dueAt)}
                    </span>
                    <DueCountdown dueAt={a.dueAt} />
                    <span>{formatMarks(a.maxMarks)} marks</span>
                  </p>
                </div>
                {a.stats && (
                  <div className="w-full space-y-1 sm:w-48">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {a.stats.submitted}/{a.stats.enrolled} submitted
                      </span>
                      <span>{a.stats.graded} graded</span>
                    </div>
                    <Progress
                      value={a.stats.enrolled ? (a.stats.submitted / a.stats.enrolled) * 100 : 0}
                    />
                  </div>
                )}
                {a.submission?.gradedAt && (
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">
                      {formatMarks(a.submission.marksObtained)} / {formatMarks(a.maxMarks)}
                    </p>
                    <p className="text-xs text-muted-foreground">Grade</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant={staff ? 'outline' : 'default'}>
                    <Link to={`/assignments/${a.id}`}>
                      {staff ? 'Grade' : a.submission ? 'View' : 'Open'}
                    </Link>
                  </Button>
                  {staff && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${a.title}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(a);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => setToDelete(a)}
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {staff && (
        <AssignmentFormDialog
          courseId={course.id}
          assignment={editing}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete assignment?"
        description={`"${toDelete?.title}" and all of its submissions and grades will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
