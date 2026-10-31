import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/common/misc';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/misc';
import { useUser } from '@/features/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api';
import type { Announcement, Course } from '@/lib/types';

export function AnnouncementDialog({
  open,
  onOpenChange,
  editing,
  fixedCourseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Announcement;
  fixedCourseId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <AnnouncementForm
          editing={editing}
          fixedCourseId={fixedCourseId}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementForm({
  editing,
  fixedCourseId,
  onDone,
}: {
  editing?: Announcement;
  fixedCourseId?: string;
  onDone: () => void;
}) {
  const user = useUser();
  const queryClient = useQueryClient();
  const courses = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api.get<Course[]>('/me/courses'),
    enabled: !fixedCourseId,
  });
  const [courseId, setCourseId] = useState(
    editing ? (editing.courseId ?? '') : (fixedCourseId ?? ''),
  );
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [pinned, setPinned] = useState(editing?.isPinned ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) return setError('Title and message are required.');
    if (!editing && user.role === 'teacher' && !courseId)
      return setError('Choose one of your courses.');
    setSaving(true);
    try {
      if (editing)
        await api.patch(`/announcements/${editing.id}`, {
          title: title.trim(),
          body: body.trim(),
          isPinned: pinned,
        });
      else
        await api.post('/announcements', {
          courseId: courseId || null,
          title: title.trim(),
          body: body.trim(),
          isPinned: pinned,
        });
      toast.success(editing ? 'Announcement updated' : 'Announcement posted');
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit announcement' : 'New announcement'}</DialogTitle>
        <DialogDescription>
          {user.role === 'admin'
            ? 'Leave the course empty to post campus-wide.'
            : 'Teachers post to their own courses.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {!editing && !fixedCourseId && (
          <FormField id="ann-course" label="Audience" required={user.role === 'teacher'}>
            <NativeSelect
              id="ann-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              {user.role === 'admin' ? (
                <option value="">Everyone (campus-wide)</option>
              ) : (
                <option value="" disabled>
                  Select a course…
                </option>
              )}
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        )}
        <FormField id="ann-title" label="Title" required>
          <Input
            id="ann-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </FormField>
        <FormField id="ann-body" label="Message" required>
          <Textarea
            id="ann-body"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
          />
        </FormField>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor="ann-pin">Pin to the top of the feed</Label>
          <Switch id="ann-pin" checked={pinned} onCheckedChange={setPinned} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? 'Save' : 'Post'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
