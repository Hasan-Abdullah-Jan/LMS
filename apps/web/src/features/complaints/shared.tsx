import { Download, MessageSquareReply, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { ComplaintStatusBadge } from '@/components/common/badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { errorMessage, openSignedUrl } from '@/lib/api';
import type { Complaint, ComplaintCategory, ComplaintStatus } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  academic: 'Academic',
  technical: 'Technical',
  facility: 'Facility',
  conduct: 'Conduct',
  other: 'Other',
};

const STEPS: ComplaintStatus[] = ['open', 'in_review', 'resolved'];

/** open -> in review -> resolved/rejected progress indicator. */
export function StatusTimeline({ status }: { status: ComplaintStatus }) {
  const reached = status === 'rejected' ? 2 : STEPS.indexOf(status);
  const labels = ['Filed', 'In review', status === 'rejected' ? 'Rejected' : 'Resolved'];
  return (
    <ol className="flex items-center gap-2" aria-label="Complaint progress">
      {labels.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              i <= reached
                ? status === 'rejected' && i === 2
                  ? 'bg-destructive text-white'
                  : 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
            aria-current={i === reached ? 'step' : undefined}
          >
            {i + 1}
          </span>
          <span className={cn('text-xs', i <= reached ? 'font-medium' : 'text-muted-foreground')}>
            {label}
          </span>
          {i < labels.length - 1 && (
            <span className={cn('h-px flex-1', i < reached ? 'bg-primary' : 'bg-border')} />
          )}
        </li>
      ))}
    </ol>
  );
}

export function ComplaintBody({ complaint }: { complaint: Complaint }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ComplaintStatusBadge status={complaint.status} />
        <Badge variant="outline">{CATEGORY_LABEL[complaint.category]}</Badge>
        {complaint.course && <Badge variant="outline">{complaint.course.code}</Badge>}
      </div>
      <StatusTimeline status={complaint.status} />
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Filed {formatDateTime(complaint.createdAt)}
          {complaint.raisedBy
            ? ` by ${complaint.raisedBy.fullName} (${complaint.raisedBy.role})`
            : ''}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-line">{complaint.description}</p>
        {complaint.attachmentName && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openSignedUrl(`/complaints/${complaint.id}/attachment`).catch((e) =>
                toast.error(errorMessage(e)),
              )
            }
          >
            <Paperclip /> {complaint.attachmentName} <Download className="opacity-60" />
          </Button>
        )}
      </div>
      {complaint.followUp && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">
            Follow-up · {formatDateTime(complaint.followUpAt)}
          </p>
          <p className="whitespace-pre-line">{complaint.followUp}</p>
        </div>
      )}
      {complaint.adminResponse && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <MessageSquareReply className="size-3.5" /> Registrar response
            {complaint.resolvedBy ? ` · ${complaint.resolvedBy.fullName}` : ''}
          </p>
          <p className="whitespace-pre-line">{complaint.adminResponse}</p>
        </div>
      )}
    </div>
  );
}
