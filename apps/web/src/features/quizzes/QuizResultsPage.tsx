import { useQuery } from '@tanstack/react-query';
import { BarChart3, Trophy, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { PageHeader, StatCard } from '@/components/common/page';
import { EmptyState, ErrorState, PageLoader } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Quiz } from '@/lib/types';
import { formatDateTime, formatMarks } from '@/lib/utils';

interface Results {
  quiz: Quiz;
  summary: { submitted: number; average: number | null; highest: number | null };
  rows: Array<{
    student: { id: string; fullName: string; email: string; rollNo: string | null };
    status: 'submitted' | 'in_progress' | 'not_attempted';
    startedAt: string | null;
    submittedAt: string | null;
    score: number | null;
  }>;
}

export function QuizResultsPage() {
  const { quizId = '' } = useParams();
  const query = useQuery({
    queryKey: ['quiz-results', quizId],
    queryFn: () => api.get<Results>(`/quizzes/${quizId}/results`),
  });
  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { quiz, summary, rows } = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: `/quizzes/${quiz.id}`, label: 'Back to quiz' }}
        eyebrow="Quiz results"
        title={quiz.title}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Completed" value={`${summary.submitted}/${rows.length}`} icon={Users} />
        <StatCard
          label="Average score"
          value={
            summary.average === null
              ? '—'
              : `${formatMarks(summary.average)} / ${formatMarks(quiz.totalMarks)}`
          }
          icon={BarChart3}
          tone="info"
        />
        <StatCard
          label="Highest score"
          value={summary.highest === null ? '—' : formatMarks(summary.highest)}
          icon={Trophy}
          tone="success"
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No students enrolled" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.student.id}>
                <TableCell>
                  <p className="font-medium">{r.student.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.student.rollNo ?? r.student.email}
                  </p>
                </TableCell>
                <TableCell>
                  {r.status === 'submitted' ? (
                    <Badge variant="success">Submitted</Badge>
                  ) : r.status === 'in_progress' ? (
                    <Badge variant="warning">In progress</Badge>
                  ) : (
                    <Badge variant="muted">Not attempted</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(r.submittedAt)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {r.score === null
                    ? '—'
                    : `${formatMarks(r.score)} / ${formatMarks(quiz.totalMarks)}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
