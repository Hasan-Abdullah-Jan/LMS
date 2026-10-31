import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  FileUp,
  Pencil,
  Save,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog, SearchInput } from '@/components/common/misc';
import { PageHeader } from '@/components/common/page';
import { EmptyState, ErrorState, PageLoader } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Checkbox, UserAvatar } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, errorMessage, upload } from '@/lib/api';
import type { AdminCourseDetail, EnrollmentReport, Profile } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { CourseDialog } from './AdminCoursesPage';

/** Multi-select list of people with search. */
function PeoplePicker({
  people,
  selected,
  onChange,
  disabledIds = [],
}: {
  people: Profile[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabledIds?: string[];
}) {
  const [search, setSearch] = useState('');
  const filtered = people.filter((p) =>
    `${p.fullName} ${p.email} ${p.rollNo ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-2">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search people…"
        className="sm:w-full"
      />
      <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
        {filtered.length === 0 && (
          <li className="p-4 text-center text-sm text-muted-foreground">No matches.</li>
        )}
        {filtered.map((p) => {
          const disabled = disabledIds.includes(p.id);
          const checked = selected.includes(p.id) || disabled;
          return (
            <li key={p.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50',
                  disabled && 'cursor-default opacity-60',
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(v) =>
                    onChange(v ? [...selected, p.id] : selected.filter((id) => id !== p.id))
                  }
                  aria-label={p.fullName}
                />
                <UserAvatar name={p.fullName} className="size-7" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-medium">{p.fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[p.rollNo, p.email].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {disabled && <Badge variant="muted">Enrolled</Badge>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function useAllUsers(role: 'teacher' | 'student') {
  return useQuery({
    queryKey: ['admin-users', 'all', role],
    queryFn: async () =>
      (await api.page<Profile>('/admin/users', { role, status: 'active', pageSize: 100 })).data,
  });
}

function TeachersTab({ course }: { course: AdminCourseDetail }) {
  const queryClient = useQueryClient();
  const teachers = useAllUsers('teacher');
  const currentIds = course.teachers
    .map((t) => t.id)
    .sort()
    .join();
  const [selected, setSelected] = useState<string[]>(() => course.teachers.map((t) => t.id));
  const [syncedIds, setSyncedIds] = useState(currentIds);
  // Re-sync the picker when the saved teacher set changes (without an effect).
  if (currentIds !== syncedIds) {
    setSyncedIds(currentIds);
    setSelected(course.teachers.map((t) => t.id));
  }
  const save = useMutation({
    mutationFn: () => api.put(`/admin/courses/${course.id}/teachers`, { teacherIds: selected }),
    onSuccess: () => {
      toast.success('Teachers updated');
      void queryClient.invalidateQueries({ queryKey: ['admin-course', course.id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const dirty = [...selected].sort().join() !== currentIds;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teachers</CardTitle>
        <CardDescription>
          Select every teacher for this course. Saving replaces the current set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {teachers.isPending ? (
          <PageLoader />
        ) : teachers.isError ? (
          <ErrorState error={teachers.error} />
        ) : (
          <PeoplePicker people={teachers.data} selected={selected} onChange={setSelected} />
        )}
        <Button onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
          {!save.isPending && <Save />} Save teachers ({selected.length})
        </Button>
      </CardContent>
    </Card>
  );
}

function ReportList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={cn('text-xs font-semibold', tone)}>
        {title} ({items.length})
      </p>
      <p className="mt-1 text-xs break-all text-muted-foreground">{items.join(', ')}</p>
    </div>
  );
}

function CsvImportDialog({
  courseId,
  open,
  onOpenChange,
}: {
  courseId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <CsvImportForm courseId={courseId} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CsvImportForm({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<EnrollmentReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', new Blob([csv], { type: 'text/csv' }), 'students.csv');
      const result = await upload<EnrollmentReport>(
        `/admin/courses/${courseId}/enrollments`,
        form,
        { query: { dryRun } },
      );
      setReport(result);
      if (!dryRun) {
        toast.success(`${result.enrolled} student(s) enrolled`);
        void queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
        onDone();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import students from CSV</DialogTitle>
        <DialogDescription>
          Paste emails (one per line or comma-separated) or load a .csv file. Preview first to see
          unmatched emails.
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Textarea
        aria-label="Student emails"
        rows={6}
        className="font-mono text-xs"
        placeholder={'email\nfatima.hinai@gutech.demo\nsalim.farsi@gutech.demo'}
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setReport(null);
        }}
      />
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-primary hover:underline">
        <FileUp className="size-4" /> Load .csv file
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              setCsv(await f.text());
              setReport(null);
            }
            e.target.value = '';
          }}
        />
      </label>
      {report && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3" aria-live="polite">
          <p className="text-sm font-medium">Preview</p>
          <ReportList
            title="Will be enrolled"
            items={report.matched.map((m) => `${m.fullName} <${m.email}>`)}
            tone="text-success"
          />
          <ReportList
            title="Already enrolled"
            items={report.alreadyEnrolled}
            tone="text-muted-foreground"
          />
          <ReportList title="Duplicates in file" items={report.duplicates} tone="text-warning" />
          <ReportList
            title="Unknown (no active student with this email)"
            items={report.unknown}
            tone="text-destructive"
          />
          <ReportList title="Not valid emails" items={report.invalid} tone="text-destructive" />
        </div>
      )}
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => void run(true)}
          disabled={!csv.trim()}
          loading={busy && !report}
        >
          Preview
        </Button>
        <Button
          onClick={() => void run(false)}
          disabled={!report || report.matched.length === 0}
          loading={busy && !!report}
        >
          Enroll {report?.matched.length ?? 0} student(s)
        </Button>
      </DialogFooter>
    </>
  );
}

function StudentsTab({ course }: { course: AdminCourseDetail }) {
  const queryClient = useQueryClient();
  const students = useAllUsers('student');
  const [selected, setSelected] = useState<string[]>([]);
  const [csvOpen, setCsvOpen] = useState(false);
  const [toRemove, setToRemove] = useState<{ id: string; name: string } | null>(null);
  const enrolledIds = useMemo(() => course.students.map((s) => s.id), [course.students]);

  const enroll = useMutation({
    mutationFn: () =>
      api.post<EnrollmentReport>(`/admin/courses/${course.id}/enrollments`, {
        studentIds: selected,
      }),
    onSuccess: (r) => {
      toast.success(
        `${r.enrolled} student(s) enrolled${r.alreadyEnrolled.length ? `, ${r.alreadyEnrolled.length} already enrolled` : ''}`,
      );
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ['admin-course', course.id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unenroll = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/courses/${course.id}/enrollments/${id}`),
    onSuccess: () => {
      toast.success('Student unenrolled');
      void queryClient.invalidateQueries({ queryKey: ['admin-course', course.id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Enrolled ({course.students.length})</CardTitle>
            <CardDescription>Students who can see this course.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {course.students.length === 0 ? (
            <EmptyState icon={Users} title="No students yet" className="border-0" />
          ) : (
            <ul className="divide-y">
              {course.students.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <UserAvatar name={s.fullName} className="size-8" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{s.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[s.rollNo, s.email].filter(Boolean).join(' · ')} · since{' '}
                      {formatDate(s.enrolledAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Unenroll ${s.fullName}`}
                    onClick={() => setToRemove({ id: s.id, name: s.fullName })}
                  >
                    <UserMinus className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add students</CardTitle>
          <CardDescription>
            Pick students or import a CSV of emails. Enrolling twice is harmless.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {students.isPending ? (
            <PageLoader />
          ) : students.isError ? (
            <ErrorState error={students.error} />
          ) : (
            <PeoplePicker
              people={students.data}
              selected={selected}
              onChange={setSelected}
              disabledIds={enrolledIds}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => enroll.mutate()}
              disabled={selected.length === 0}
              loading={enroll.isPending}
            >
              {!enroll.isPending && <UserPlus />} Enroll {selected.length || ''}
            </Button>
            <Button variant="outline" onClick={() => setCsvOpen(true)}>
              <FileUp /> Import CSV
            </Button>
          </div>
        </CardContent>
      </Card>
      <CsvImportDialog courseId={course.id} open={csvOpen} onOpenChange={setCsvOpen} />
      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Unenroll student?"
        description={`${toRemove?.name} will lose access to this course. Their past submissions are kept.`}
        confirmLabel="Unenroll"
        destructive
        onConfirm={() => toRemove && unenroll.mutate(toRemove.id)}
      />
    </div>
  );
}

export function AdminCourseDetailPage() {
  const { courseId = '' } = useParams();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const query = useQuery({
    queryKey: ['admin-course', courseId],
    queryFn: () => api.get<AdminCourseDetail>(`/admin/courses/${courseId}`),
  });
  const archive = useMutation({
    mutationFn: (isArchived: boolean) => api.patch(`/admin/courses/${courseId}`, { isArchived }),
    onSuccess: (_d, isArchived) => {
      toast.success(isArchived ? 'Course archived' : 'Course restored');
      void queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const course = query.data;

  return (
    <div>
      <PageHeader
        back={{ to: '/admin/courses', label: 'All courses' }}
        eyebrow={<span className="font-mono">{course.code}</span>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {course.title} {course.isArchived && <Badge variant="muted">Archived</Badge>}
          </span>
        }
        description={course.description ?? undefined}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/courses/${course.id}`}>
                <ExternalLink /> Open course
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            {course.isArchived ? (
              <Button
                variant="outline"
                onClick={() => archive.mutate(false)}
                loading={archive.isPending}
              >
                <ArchiveRestore /> Restore
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirmArchive(true)}>
                <Archive /> Archive
              </Button>
            )}
          </>
        }
      />
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students ({course.students.length})</TabsTrigger>
          <TabsTrigger value="teachers">Teachers ({course.teachers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="students">
          <StudentsTab course={course} />
        </TabsContent>
        <TabsContent value="teachers">
          <TeachersTab course={course} />
        </TabsContent>
      </Tabs>
      <CourseDialog open={editOpen} onOpenChange={setEditOpen} editing={course} />
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive course?"
        description="Students and teachers will no longer see it. All data is kept and you can restore it later."
        confirmLabel="Archive"
        onConfirm={() => archive.mutate(true)}
      />
    </div>
  );
}
