import { Globe2, Pin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/misc';
import type { Announcement } from '@/lib/types';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';

export function AnnouncementCard({
  announcement,
  actions,
  compact = false,
}: {
  announcement: Announcement;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const a = announcement;
  return (
    <article
      className={cn(
        'relative rounded-xl border bg-card p-4 shadow-xs sm:p-5',
        a.isPinned && 'border-brand/40 bg-accent/30',
        !a.isRead &&
          'before:absolute before:top-5 before:left-0 before:h-6 before:w-1 before:rounded-r before:bg-primary',
      )}
      aria-label={a.title}
    >
      <div className="flex items-start gap-3">
        {!compact && <UserAvatar name={a.author?.fullName ?? 'GUTECH'} />}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {a.isPinned && (
              <Badge variant="brand">
                <Pin /> Pinned
              </Badge>
            )}
            {a.course ? (
              <Badge variant="outline">{a.course.code}</Badge>
            ) : (
              <Badge variant="info">
                <Globe2 /> Campus-wide
              </Badge>
            )}
            {!a.isRead && <Badge variant="default">New</Badge>}
          </div>
          <h3 className="font-semibold leading-snug">{a.title}</h3>
          <p
            className={cn(
              'text-sm whitespace-pre-line text-muted-foreground',
              compact && 'line-clamp-2',
            )}
          >
            {a.body}
          </p>
          <p className="text-xs text-muted-foreground">
            {a.author?.fullName ?? 'Unknown'} ·{' '}
            <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>
              {timeAgo(a.createdAt)}
            </time>
          </p>
        </div>
        {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
      </div>
    </article>
  );
}
