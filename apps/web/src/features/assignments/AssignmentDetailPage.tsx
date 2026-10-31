import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Download, Paperclip, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { SubmissionStatusBadge } from '@/components/common/badges';
import { DueCountdown } from '@/components/common/Countdown';
import { PageHeader } from '@/components/common/page';
import { ErrorState, PageLoader } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCourseQuery } from '@/features/courses/useCourse';
import { api, errorMessage, openSignedUrl } from '@/lib/api';
import type { Assignment } from '@/lib/types';
import { formatDateTime, formatMarks } from '@/lib/utils';
import { GradingTable } from './GradingTable';
import { SubmissionPanel } from './SubmissionPanel';

export function AssignmentDetailPage() {
  const { assignmentId = '' } = useParams();
  const query = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => api.get<Assignment>(`/assignments/${assignmentId}`),
  });
  const course = useCourseQuery(query.data?.courseId ?? '');
  const [downloading, setDownloading] = useState(false);

  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const a = query.data;
  const isStudent = a.myRole === 'student';

  const downloadAttachment = async () => {
    setDownloading(true);
    try {
      await openSignedUrl(`/assignments/${a.id}/attachment`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={{
          to: `/courses/${a.courseId}/assignments`,
          label: course.data ? `${course.data.code} assignments` : 'Back to course',
        }}
        eyebrow={course.data?.title}
        title={a.title}
        actions={a.status && <SubmissionStatusBadge status={a.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed whitespace-pre-line">{a.instructions}</p>
            {a.attachmentName && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void downloadAttachment()}
                loading={downloading}
              >
                {!downloading && <Paperclip />} {a.attachmentName}{' '}
                <Download className="opacity-60" />
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarClock className="size-4" /> Due
                </dt>
                <dd className="text-right">
                  {formatDateTime(a.dueAt)}
                  <br />
                  <DueCountdown dueAt={a.dueAt} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Trophy className="size-4" /> Max marks
                </dt>
                <dd className="font-semibold">{formatMarks(a.maxMarks)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Late submissions</dt>
                <dd>
                  {a.allowLate ? (
                    <Badge variant="warning">Accepted (flagged)</Badge>
                  ) : (
                    <Badge variant="muted">Not accepted</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
      {isStudent ? <SubmissionPanel assignment={a} /> : <GradingTable assignment={a} />}
    </div>
  );
}
