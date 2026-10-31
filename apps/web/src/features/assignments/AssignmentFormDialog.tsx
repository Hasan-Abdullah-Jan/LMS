import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { DOCUMENT_ACCEPT, FileDropzone } from '@/components/common/FileDropzone';
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
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/misc';
import { api, errorMessage, upload } from '@/lib/api';
import type { Assignment } from '@/lib/types';
import { fromLocalInput, toLocalInput } from '@/lib/utils';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200),
  instructions: z.string().trim().min(1, 'Instructions are required.').max(20000),
  maxMarks: z.coerce.number<string>().positive('Must be greater than 0.').max(9999.99),
  dueAt: z.string().min(1, 'Choose a due date.'),
  allowLate: z.boolean(),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export function AssignmentFormDialog({
  courseId,
  assignment,
  open,
  onOpenChange,
}: {
  courseId: string;
  assignment?: Assignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <AssignmentForm
          courseId={courseId}
          assignment={assignment}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function defaultsFor(assignment: Assignment | undefined): Values {
  return {
    title: assignment?.title ?? '',
    instructions: assignment?.instructions ?? '',
    maxMarks: String(assignment?.maxMarks ?? 10),
    dueAt: toLocalInput(assignment?.dueAt ?? new Date(Date.now() + 7 * 86400_000)),
    allowLate: assignment?.allowLate ?? false,
  };
}

function AssignmentForm({
  courseId,
  assignment,
  onDone,
}: {
  courseId: string;
  assignment?: Assignment;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const editing = Boolean(assignment);
  const [initialValues] = useState(() => defaultsFor(assignment));
  const { register, handleSubmit, control, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = { ...values, dueAt: fromLocalInput(values.dueAt) };
    try {
      if (editing) {
        await api.patch(`/assignments/${assignment!.id}`, payload);
      } else {
        const form = new FormData();
        form.append('title', payload.title);
        form.append('instructions', payload.instructions);
        form.append('maxMarks', String(payload.maxMarks));
        form.append('dueAt', payload.dueAt);
        form.append('allowLate', String(payload.allowLate));
        if (file) form.append('attachment', file);
        await upload(`/courses/${courseId}/assignments`, form);
      }
      toast.success(editing ? 'Assignment updated' : 'Assignment created');
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['assignment'] });
      onDone();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit assignment' : 'New assignment'}</DialogTitle>
        <DialogDescription>
          Lateness is decided by the server clock at the moment a student submits.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
          >
            {formError}
          </p>
        )}
        <FormField id="a-title" label="Title" error={formState.errors.title?.message} required>
          <Input id="a-title" {...register('title')} aria-invalid={!!formState.errors.title} />
        </FormField>
        <FormField
          id="a-instructions"
          label="Instructions"
          error={formState.errors.instructions?.message}
          required
        >
          <Textarea
            id="a-instructions"
            rows={5}
            {...register('instructions')}
            aria-invalid={!!formState.errors.instructions}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="a-max"
            label="Max marks"
            error={formState.errors.maxMarks?.message}
            required
          >
            <Input
              id="a-max"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              {...register('maxMarks')}
            />
          </FormField>
          <FormField
            id="a-due"
            label="Due date & time"
            error={formState.errors.dueAt?.message}
            required
          >
            <Input id="a-due" type="datetime-local" {...register('dueAt')} />
          </FormField>
        </div>
        <Controller
          control={control}
          name="allowLate"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <Label htmlFor="a-late">Accept late submissions</Label>
                <p className="text-xs text-muted-foreground">
                  Late work is accepted and flagged. Otherwise it is blocked after the deadline.
                </p>
              </div>
              <Switch id="a-late" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
        {!editing && (
          <div className="space-y-1.5">
            <Label>Attachment (optional)</Label>
            <FileDropzone
              file={file}
              onFile={setFile}
              accept={DOCUMENT_ACCEPT}
              maxBytes={25 * 1024 * 1024}
              hint="Brief, template or starter files · max 25 MB"
              id="a-file"
            />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            {editing ? 'Save changes' : 'Create assignment'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
