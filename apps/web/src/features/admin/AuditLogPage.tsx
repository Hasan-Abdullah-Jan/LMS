import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';
import { PageHeader, Pagination } from '@/components/common/page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
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
import type { AuditEntry } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['audit', page],
    queryFn: () => api.page<AuditEntry>('/admin/audit-log', { page, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Who graded, deleted or changed what — including every admin change to users and courses."
      />
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                    {formatDateTime(e.at)}
                  </TableCell>
                  <TableCell className="font-medium">{e.actor?.fullName ?? 'System'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {e.action}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-md truncate font-mono text-xs text-muted-foreground"
                    title={JSON.stringify(e.details)}
                  >
                    {Object.keys(e.details ?? {}).length ? JSON.stringify(e.details) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={25}
            total={query.data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
