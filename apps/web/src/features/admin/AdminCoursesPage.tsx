import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FormField, SearchInput } from '@/components/common/misc';
import { PageHeader, Pagination } from '@/components/common/page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, api, errorMessage } from '@/lib/api';
import type { Course } from '@/lib/types';

export function CourseDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Course;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CourseForm editing={editing} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CourseForm({ editing, onDone }: { editing?: Course; onDone: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [code, setCode] = useState(editing?.code ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[A-Za-z0-9-]{2,16}$/.test(code.trim()))
      next.code = 'Use 2–16 letters, numbers or hyphens (e.g. CS101).';
    if (title.trim().length < 2) next.title = 'Enter a course title.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const body = {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        description: description.trim() || (editing ? null : undefined),
      };
      const course = editing
        ? await api.patch<Course>(`/admin/courses/${editing.id}`, body)
        : await api.post<Course>('/admin/courses', body);
      toast.success(editing ? 'Course updated' : 'Course created');
      void queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-course', course.id] });
      onDone();
      if (!editing) navigate(`/admin/courses/${course.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.details.length)
        setErrors(Object.fromEntries(error.details.map((d) => [d.path ?? 'form', d.message])));
      else setErrors({ form: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit course' : 'Create course'}</DialogTitle>
        <DialogDescription>
          After creating the course, assign teachers and enroll students.
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
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <FormField id="course-code" label="Code" error={errors.code} required>
            <Input
              id="course-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={16}
              placeholder="CS101"
              className="font-mono"
            />
          </FormField>
          <FormField id="course-title" label="Title" error={errors.title} required>
            <Input
              id="course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
          </FormField>
        </div>
        <FormField id="course-desc" label="Description">
          <Textarea
            id="course-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? 'Save' : 'Create course'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function AdminCoursesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({
    queryKey: ['admin-courses', search, status, page],
    queryFn: () => api.page<Course>('/admin/courses', { search, status, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Create courses, assign teachers and enroll students. Courses are archived, never deleted."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Create course
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Code or title…"
          label="Search courses"
        />
        <NativeSelect
          aria-label="Filter by status"
          className="sm:w-40"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </NativeSelect>
      </div>
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses found"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Create course
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Teachers</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/admin/courses/${c.id}`} className="font-medium hover:underline">
                      <span className="font-mono text-muted-foreground">{c.code}</span> · {c.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.teachers.map((t) => t.fullName).join(', ') || (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{c.studentCount}</TableCell>
                  <TableCell>
                    {c.isArchived ? (
                      <Badge variant="muted">Archived</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/courses/${c.id}`}>Manage</Link>
                    </Button>
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
      <CourseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
