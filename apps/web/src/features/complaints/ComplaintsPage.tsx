import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ComplaintStatusBadge } from '@/components/common/badges';
import { COMPLAINT_ACCEPT, FileDropzone } from '@/components/common/FileDropzone';
import { FormField } from '@/components/common/misc';
import { PageHeader, Pagination } from '@/components/common/page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SheetContent,
} from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { api, errorMessage, upload } from '@/lib/api';
import type { Complaint, ComplaintCategory, Course } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { CATEGORY_LABEL, ComplaintBody } from './shared';

function RaiseComplaintDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <RaiseComplaintForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RaiseComplaintForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const courses = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api.get<Course[]>('/me/courses'),
  });
  const [category, setCategory] = useState<ComplaintCategory | ''>('');
  const [courseId, setCourseId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!category) next.category = 'Choose a category.';
    if (subject.trim().length < 3) next.subject = 'Subject must be at least 3 characters.';
    if (description.trim().length < 10)
      next.description = 'Please describe the issue (at least 10 characters).';
    setErrors(next);
    if (Object.keys(next).length) return;
    const form = new FormData();
    form.append('category', category);
    form.append('subject', subject.trim());
    form.append('description', description.trim());
    if (courseId) form.append('courseId', courseId);
    if (file) form.append('attachment', file);
    setSaving(true);
    try {
      await upload('/complaints', form);
      toast.success('Complaint submitted. You will be notified when its status changes.');
      void queryClient.invalidateQueries({ queryKey: ['complaints'] });
      onDone();
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Raise a complaint</DialogTitle>
        <DialogDescription>
          Complaints go to the registrar. They can't be edited after filing, but you can add one
          follow-up.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
          >
            {errors.form}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="c-category" label="Category" error={errors.category} required>
            <NativeSelect
              id="c-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
              aria-invalid={!!errors.category}
            >
              <option value="" disabled>
                Select…
              </option>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="c-course" label="Related course (optional)">
            <NativeSelect
              id="c-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">None</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        <FormField id="c-subject" label="Subject" error={errors.subject} required>
          <Input
            id="c-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            aria-invalid={!!errors.subject}
          />
        </FormField>
        <FormField id="c-description" label="Description" error={errors.description} required>
          <Textarea
            id="c-description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            aria-invalid={!!errors.description}
          />
        </FormField>
        <div className="space-y-1.5">
          <Label>Attachment (optional)</Label>
          <FileDropzone
            file={file}
            onFile={setFile}
            accept={COMPLAINT_ACCEPT}
            maxBytes={10 * 1024 * 1024}
            hint="PDF, DOCX or image · max 10 MB"
            id="c-file"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Submit complaint
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function ComplaintSheet({
  complaintId,
  onClose,
}: {
  complaintId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [followUp, setFollowUp] = useState('');
  const query = useQuery({
    queryKey: ['complaint', complaintId],
    queryFn: () => api.get<Complaint>(`/complaints/${complaintId}`),
    enabled: Boolean(complaintId),
  });
  const addFollowUp = useMutation({
    mutationFn: () =>
      api.post<Complaint>(`/complaints/${complaintId}/follow-up`, { comment: followUp.trim() }),
    onSuccess: (c) => {
      toast.success('Follow-up added');
      setFollowUp('');
      queryClient.setQueryData(['complaint', complaintId], c);
      void queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={Boolean(complaintId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {query.isPending ? (
          <ListSkeleton rows={2} />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : (
          <>
            <DialogPrimitive.Title className="pr-8 text-lg font-semibold">
              {query.data.subject}
            </DialogPrimitive.Title>
            <ComplaintBody complaint={query.data} />
            {!query.data.followUp && !['resolved', 'rejected'].includes(query.data.status) && (
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="follow-up">Add a follow-up comment (one allowed)</Label>
                <Textarea
                  id="follow-up"
                  rows={3}
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  maxLength={2000}
                />
                <Button
                  onClick={() => addFollowUp.mutate()}
                  disabled={!followUp.trim()}
                  loading={addFollowUp.isPending}
                >
                  Add follow-up
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Dialog>
  );
}

export function ComplaintsPage() {
  const [params, setParams] = useSearchParams();
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [page, setPage] = useState(1);
  const openId = params.get('open');
  const query = useQuery({
    queryKey: ['complaints', 'mine', page],
    queryFn: () => api.page<Complaint>('/complaints/mine', { page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Complaints"
        description="Raise an academic, technical, facility or conduct issue and track its progress."
        actions={
          <Button onClick={() => setRaiseOpen(true)}>
            <Plus /> Raise a complaint
          </Button>
        }
      />
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No complaints filed"
          description="If something isn't right, let the registrar know."
          action={
            <Button onClick={() => setRaiseOpen(true)}>
              <Plus /> Raise a complaint
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {query.data.data.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setParams({ open: c.id })}
                  className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-xs transition hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL[c.category]}
                      {c.course ? ` · ${c.course.code}` : ''} · filed {timeAgo(c.createdAt)}
                    </p>
                  </div>
                  <ComplaintStatusBadge status={c.status} />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={10}
            total={query.data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}
      <RaiseComplaintDialog open={raiseOpen} onOpenChange={setRaiseOpen} />
      <ComplaintSheet complaintId={openId} onClose={() => setParams({})} />
    </div>
  );
}
