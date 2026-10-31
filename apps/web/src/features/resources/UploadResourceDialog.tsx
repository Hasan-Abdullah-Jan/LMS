import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
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
import { Progress } from '@/components/ui/misc';
import { errorMessage, upload } from '@/lib/api';

const MAX = 25 * 1024 * 1024;

export function UploadResourceDialog({
  courseId,
  open,
  onOpenChange,
}: {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ title?: string; file?: string; form?: string }>({});

  const reset = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    setProgress(null);
    setErrors({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Give the resource a title.';
    if (!file) next.file = 'Choose a file to upload.';
    setErrors(next);
    if (next.title || next.file) return;

    const form = new FormData();
    form.append('title', title.trim());
    if (description.trim()) form.append('description', description.trim());
    form.append('file', file!);
    setProgress(0);
    try {
      await upload(`/courses/${courseId}/resources`, form, { onProgress: setProgress });
      toast.success('Resource uploaded');
      void queryClient.invalidateQueries({ queryKey: ['resources', courseId] });
      reset();
      onOpenChange(false);
    } catch (error) {
      setProgress(null);
      setErrors({ form: errorMessage(error) });
    }
  };

  const busy = progress !== null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!busy) {
          onOpenChange(o);
          if (!o) reset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload resource</DialogTitle>
          <DialogDescription>
            PDF, DOCX, PPTX, ZIP or images, up to 25 MB. Files are stored privately.
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
          <FormField id="resource-title" label="Title" error={errors.title} required>
            <Input
              id="resource-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Week 3 - Loops"
            />
          </FormField>
          <FormField id="resource-description" label="Description">
            <Textarea
              id="resource-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </FormField>
          <div className="space-y-1.5">
            <FileDropzone
              file={file}
              onFile={setFile}
              accept={DOCUMENT_ACCEPT}
              maxBytes={MAX}
              hint="PDF, DOCX, PPTX, ZIP, PNG, JPG, GIF, WEBP · max 25 MB"
              id="resource-file"
            />
            {errors.file && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors.file}
              </p>
            )}
          </div>
          {busy && (
            <div className="space-y-1" aria-live="polite">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
