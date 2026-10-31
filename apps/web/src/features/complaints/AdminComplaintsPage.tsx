import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ComplaintStatusBadge } from '@/components/common/badges';
import { SearchInput } from '@/components/common/misc';
import { PageHeader, Pagination } from '@/components/common/page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ApiError, api, errorMessage } from '@/lib/api';
import type { Complaint, ComplaintStatus } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { CATEGORY_LABEL, ComplaintBody } from './shared';

const NEXT: Record<ComplaintStatus, ComplaintStatus[]> = {
  open: ['in_review'],
  in_review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};
const ACTION_LABEL: Record<ComplaintStatus, string> = {
  open: 'Reopen',
  in_review: 'Start review',
  resolved: 'Resolve',
  rejected: 'Reject',
};

function ReviewDrawer({
  complaint,
  onClose,
}: {
  complaint: Complaint | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(complaint)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {complaint && <ReviewPanel key={complaint.id} complaint={complaint} onClose={onClose} />}
      </SheetContent>
    </Dialog>
  );
}

function ReviewPanel({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [response, setResponse] = useState(complaint.adminResponse ?? '');
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: (status?: ComplaintStatus) =>
      api.patch<Complaint>(`/admin/complaints/${complaint.id}`, {
        ...(status && { status }),
        adminResponse: response.trim() || undefined,
      }),
    onSuccess: (c) => {
      toast.success(`Complaint ${c.status.replace('_', ' ')}`);
      void queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
      onClose();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError ? (e.fieldError('adminResponse') ?? e.message) : errorMessage(e),
      ),
  });

  const closed = ['resolved', 'rejected'].includes(complaint.status);
  return (
    <>
      <DialogPrimitive.Title className="pr-8 text-lg font-semibold">
        {complaint.subject}
      </DialogPrimitive.Title>
      <ComplaintBody complaint={complaint} />
      {!closed && (
        <div className="space-y-3 border-t pt-4">
          <Label htmlFor="admin-response">Response to the complainant</Label>
          <Textarea
            id="admin-response"
            rows={4}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            maxLength={5000}
            placeholder="Required to resolve or reject"
            aria-invalid={!!error}
          />
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {NEXT[complaint.status].map((status) => (
              <Button
                key={status}
                variant={status === 'rejected' ? 'destructive' : 'default'}
                onClick={() => update.mutate(status)}
                loading={update.isPending && update.variables === status}
              >
                {ACTION_LABEL[status]}
              </Button>
            ))}
            {complaint.status === 'in_review' && (
              <Button
                variant="outline"
                onClick={() => update.mutate(undefined)}
                disabled={!response.trim()}
                loading={update.isPending && update.variables === undefined}
              >
                Save response
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            The complainant gets an in-app notification on every status change.
          </p>
        </div>
      )}
    </>
  );
}

export function AdminComplaintsPage() {
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const query = useQuery({
    queryKey: ['admin-complaints', status, category, search, page],
    queryFn: () =>
      api.page<Complaint>('/admin/complaints', { status, category, search, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Complaints queue"
        description="Review complaints from students and faculty. Status flow: open → in review → resolved or rejected."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search subject…"
          label="Search complaints"
        />
        <NativeSelect
          aria-label="Filter by status"
          className="sm:w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_review">In review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Filter by category"
          className="sm:w-44"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No complaints match"
          description="Try changing the filters."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Filed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell className="max-w-xs">
                    <button
                      className="truncate text-left font-medium hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(c);
                      }}
                    >
                      {c.subject}
                    </button>
                    {c.course && (
                      <span className="block text-xs text-muted-foreground">{c.course.code}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.raisedBy?.fullName}
                    <span className="block text-xs text-muted-foreground capitalize">
                      {c.raisedBy?.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{CATEGORY_LABEL[c.category]}</Badge>
                  </TableCell>
                  <TableCell>
                    <ComplaintStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {timeAgo(c.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={15}
            total={query.data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}
      <ReviewDrawer complaint={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
