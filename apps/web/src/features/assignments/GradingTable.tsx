import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Save, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SubmissionStatusBadge } from '@/components/common/badges';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, api, errorMessage, openSignedUrl } from '@/lib/api';
import type { Assignment, GradingRow } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

function GradeRow({ row, assignment }: { row: GradingRow; assignment: Assignment }) {
  const queryClient = useQueryClient();
  const s = row.submission;
  const [marks, setMarks] = useState(s?.marksObtained?.toString() ?? '');
  const [feedback, setFeedback] = useState(s?.feedback ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/submissions/${s!.id}/grade`, {
        marks: Number(marks),
        feedback: feedback.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      toast.success(`Saved grade for ${row.student.fullName}`);
      void queryClient.invalidateQueries({ queryKey: ['submissions', assignment.id] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? (err.fieldError('marks') ?? err.message) : errorMessage(err),
      ),
  });

  const invalid =
    marks === '' ||
    Number.isNaN(Number(marks)) ||
    Number(marks) < 0 ||
    Number(marks) > assignment.maxMarks;
  const dirty = marks !== (s?.marksObtained?.toString() ?? '') || feedback !== (s?.feedback ?? '');

  return (
    <TableRow className="align-top" id={s ? `submission-${s.id}` : undefined}>
      <TableCell className="min-w-44">
        <p className="font-medium">{row.student.fullName}</p>
        <p className="text-xs text-muted-foreground">{row.student.rollNo ?? row.student.email}</p>
      </TableCell>
      <TableCell>
        <SubmissionStatusBadge status={row.status} />
      </TableCell>
      <TableCell className="min-w-56 text-sm">
        {s ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{formatDateTime(s.submittedAt)}</p>
            {s.textAnswer && (
              <p
                className="line-clamp-3 max-w-xs font-mono text-xs whitespace-pre-wrap"
                title={s.textAnswer}
              >
                {s.textAnswer}
              </p>
            )}
            {s.fileName && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  openSignedUrl(`/submissions/${s.id}/file`).catch((e) =>
                    toast.error(errorMessage(e)),
                  )
                }
              >
                <Download /> {s.fileName}
              </Button>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">No submission</span>
        )}
      </TableCell>
      <TableCell className="w-28">
        {s && (
          <div>
            <div className="flex items-center gap-1">
              <Input
                aria-label={`Marks for ${row.student.fullName}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={assignment.maxMarks}
                step="0.25"
                className="h-9 w-20"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                aria-invalid={!!error || (marks !== '' && invalid)}
              />
              <span className="text-xs text-muted-foreground">/{assignment.maxMarks}</span>
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="min-w-56">
        {s && (
          <Input
            aria-label={`Feedback for ${row.student.fullName}`}
            className="h-9"
            placeholder="Feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={5000}
          />
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </TableCell>
      <TableCell className="text-right">
        {s && (
          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={invalid || !dirty}
            loading={save.isPending}
          >
            {!save.isPending && <Save />} Save
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function GradingTable({ assignment }: { assignment: Assignment }) {
  const query = useQuery({
    queryKey: ['submissions', assignment.id],
    queryFn: () => api.get<{ rows: GradingRow[] }>(`/assignments/${assignment.id}/submissions`),
  });
  const rows = query.data?.rows ?? [];
  const submitted = rows.filter((r) => r.submission).length;
  const graded = rows.filter((r) => r.status === 'graded').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions & grading</CardTitle>
        <CardDescription>
          {submitted} of {rows.length} students submitted · {graded} graded. Marks must be between 0
          and {assignment.maxMarks}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <ListSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No students enrolled" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <GradeRow
                  key={`${row.student.id}-${row.submission?.id ?? 'none'}-${row.submission?.gradedAt ?? ''}`}
                  row={row}
                  assignment={assignment}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
