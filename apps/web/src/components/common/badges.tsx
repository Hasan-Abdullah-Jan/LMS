import {
  CheckCircle2,
  Clock,
  FileWarning,
  Hourglass,
  Lock,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ComplaintStatus, Role, StudentQuizStatus, SubmissionStatus } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/roles';

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  switch (status) {
    case 'graded':
      return (
        <Badge variant="success">
          <CheckCircle2 /> Graded
        </Badge>
      );
    case 'submitted':
      return (
        <Badge variant="info">
          <CheckCircle2 /> Submitted
        </Badge>
      );
    case 'late':
      return (
        <Badge variant="warning">
          <FileWarning /> Late
        </Badge>
      );
    case 'missed':
      return (
        <Badge variant="danger">
          <XCircle /> Missed
        </Badge>
      );
    default:
      return (
        <Badge variant="muted">
          <Clock /> Pending
        </Badge>
      );
  }
}

export function QuizStatusBadge({ status }: { status: StudentQuizStatus }) {
  switch (status) {
    case 'open':
      return (
        <Badge variant="success">
          <PlayCircle /> Open
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge variant="warning">
          <Hourglass /> In progress
        </Badge>
      );
    case 'submitted':
      return (
        <Badge variant="info">
          <CheckCircle2 /> Submitted
        </Badge>
      );
    case 'upcoming':
      return (
        <Badge variant="muted">
          <Clock /> Upcoming
        </Badge>
      );
    case 'missed':
      return (
        <Badge variant="danger">
          <XCircle /> Missed
        </Badge>
      );
    default:
      return (
        <Badge variant="muted">
          <Lock /> Closed
        </Badge>
      );
  }
}

const COMPLAINT_STYLE: Record<
  ComplaintStatus,
  { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }
> = {
  open: { label: 'Open', variant: 'info' },
  in_review: { label: 'In review', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  const style = COMPLAINT_STYLE[status];
  return <Badge variant={style.variant}>{style.label}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  const variant = role === 'admin' ? 'brand' : role === 'teacher' ? 'info' : 'muted';
  return <Badge variant={variant}>{ROLE_LABEL[role]}</Badge>;
}
