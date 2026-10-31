import { UploadCloud, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/lib/utils';

export function FileDropzone({
  file,
  onFile,
  accept,
  maxBytes,
  hint,
  id = 'file',
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  accept: string;
  maxBytes: number;
  hint: string;
  id?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (candidate: File | undefined | null) => {
    setError(null);
    if (!candidate) return;
    if (candidate.size > maxBytes) {
      setError(
        `"${candidate.name}" is ${formatBytes(candidate.size)}. The maximum is ${formatBytes(maxBytes)}.`,
      );
      return;
    }
    onFile(candidate);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="space-y-1.5">
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <UploadCloud className="size-5 text-primary" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onFile(null)}
            aria-label="Remove file"
          >
            <X />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) =>
            (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())
          }
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-describedby={`${id}-hint`}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-input hover:border-primary/60 hover:bg-muted/40',
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm">
            <span className="font-medium text-primary">Click to choose</span> or drag and drop
          </p>
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        </div>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export const DOCUMENT_ACCEPT = '.pdf,.docx,.pptx,.zip,.png,.jpg,.jpeg,.gif,.webp';
export const COMPLAINT_ACCEPT = '.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp';
