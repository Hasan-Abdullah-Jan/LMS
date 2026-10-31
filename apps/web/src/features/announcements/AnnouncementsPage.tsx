import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/misc';
import { PageHeader, Pagination } from '@/components/common/page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { useUser } from '@/features/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api';
import { isStaff } from '@/lib/roles';
import type { Announcement, Course } from '@/lib/types';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementDialog } from './AnnouncementDialog';

const PAGE_SIZE = 10;

export function AnnouncementFeed({
  courseId: fixedCourseId,
  canPost,
}: {
  courseId?: string;
  canPost: boolean;
}) {
  const user = useUser();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState(fixedCourseId ?? '');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Announcement }>({ open: false });
  const [toDelete, setToDelete] = useState<Announcement | null>(null);

  const courses = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api.get<Course[]>('/me/courses'),
    enabled: !fixedCourseId,
  });
  const feed = useQuery({
    queryKey: ['announcements', 'feed', filter, page],
    queryFn: () =>
      api.page<Announcement>('/announcements', {
        courseId: filter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const markRead = useMutation({
    mutationFn: () => api.post('/announcements/read', {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });
  // Opening the feed marks what you've seen as read (up to now).
  const hasUnread = feed.data?.data.some((a) => !a.isRead);
  useEffect(() => {
    if (!hasUnread) return;
    const t = setTimeout(() => markRead.mutate(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      toast.success('Announcement deleted');
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!fixedCourseId ? (
          <NativeSelect
            aria-label="Filter by course"
            className="sm:w-72"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All announcements</option>
            <option value="global">Campus-wide only</option>
            {(courses.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {hasUnread && (
            <Button
              variant="outline"
              onClick={() => markRead.mutate()}
              loading={markRead.isPending}
            >
              <CheckCheck /> Mark all read
            </Button>
          )}
          {canPost && (
            <Button onClick={() => setDialog({ open: true })}>
              <Plus /> New announcement
            </Button>
          )}
        </div>
      </div>

      {feed.isPending ? (
        <ListSkeleton />
      ) : feed.isError ? (
        <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
      ) : feed.data.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="Announcements from your teachers and the registrar appear here."
        />
      ) : (
        <>
          <div className="space-y-3">
            {feed.data.data.map((a) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                actions={
                  (user.role === 'admin' || a.authorId === user.id) && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit announcement"
                        onClick={() => setDialog({ open: true, editing: a })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete announcement"
                        onClick={() => setToDelete(a)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </>
                  )
                }
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={feed.data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}

      {canPost && (
        <AnnouncementDialog
          open={dialog.open}
          editing={dialog.editing}
          fixedCourseId={fixedCourseId}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete announcement?"
        description={`"${toDelete?.title}" will be removed for everyone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

export function AnnouncementsPage() {
  const user = useUser();
  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Pinned items always appear first. New posts arrive in real time."
      />
      <AnnouncementFeed canPost={isStaff(user.role)} />
    </div>
  );
}
