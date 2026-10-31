import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog, FileTypeIcon, SearchInput } from '@/components/common/misc';
import { Pagination } from '@/components/common/page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/misc';
import { useUser } from '@/features/auth/AuthProvider';
import { useCourse } from '@/features/courses/useCourse';
import { api, errorMessage, openSignedUrl } from '@/lib/api';
import { isStaff } from '@/lib/roles';
import type { Resource } from '@/lib/types';
import { formatBytes, formatDate } from '@/lib/utils';
import { UploadResourceDialog } from './UploadResourceDialog';

const PAGE_SIZE = 10;

export function ResourcesTab() {
  const course = useCourse();
  const user = useUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Resource | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const staff = isStaff(course.myRole);

  const query = useQuery({
    queryKey: ['resources', course.id, search, page],
    queryFn: () =>
      api.page<Resource>(`/courses/${course.id}/resources`, { search, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/resources/${id}`),
    onSuccess: () => {
      toast.success('Resource deleted');
      void queryClient.invalidateQueries({ queryKey: ['resources', course.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const download = async (resource: Resource) => {
    setDownloading(resource.id);
    try {
      await openSignedUrl(`/resources/${resource.id}/download`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by title…"
          label="Search resources"
        />
        {staff && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload /> Upload resource
          </Button>
        )}
      </div>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? 'No matching resources' : 'No resources yet'}
          description={
            search
              ? 'Try another search.'
              : staff
                ? 'Upload lecture slides, readings and files for your students.'
                : 'Your teachers have not uploaded anything yet.'
          }
          action={
            staff && !search ? (
              <Button onClick={() => setUploadOpen(true)}>
                <Upload /> Upload the first file
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {query.data.data.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-4 rounded-xl border bg-card p-3 shadow-xs sm:p-4"
              >
                <FileTypeIcon mimeType={r.mimeType} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  {r.description && (
                    <p className="truncate text-sm text-muted-foreground">{r.description}</p>
                  )}
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.fileName} · {formatBytes(r.sizeBytes)} · {formatDate(r.createdAt)} ·{' '}
                    {r.uploadedBy?.fullName ?? 'Unknown'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void download(r)}
                    loading={downloading === r.id}
                  >
                    {downloading !== r.id && <Download />}{' '}
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  {(user.role === 'admin' || r.uploadedBy?.id === user.id) && (
                    <Tooltip content="Delete">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${r.title}`}
                        onClick={() => setToDelete(r)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}

      {staff && (
        <UploadResourceDialog courseId={course.id} open={uploadOpen} onOpenChange={setUploadOpen} />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete resource?"
        description={`"${toDelete?.title}" and its file will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
