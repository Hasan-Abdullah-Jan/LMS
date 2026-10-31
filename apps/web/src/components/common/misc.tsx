import { File, FileArchive, FileImage, FileText, Presentation, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const { Icon, tone } = mimeType.startsWith('image/')
    ? {
        Icon: FileImage,
        tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
      }
    : mimeType === 'application/pdf'
      ? { Icon: FileText, tone: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' }
      : mimeType.includes('presentation')
        ? {
            Icon: Presentation,
            tone: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
          }
        : mimeType.includes('word')
          ? {
              Icon: FileText,
              tone: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
            }
          : mimeType.includes('zip')
            ? {
                Icon: FileArchive,
                tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
              }
            : { Icon: File, tone: 'bg-muted text-muted-foreground' };
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        tone,
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </div>
  );
}

export function FormField({
  id,
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Debounced search box. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // Adopt external changes (e.g. a reset) without an effect.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  useEffect(() => {
    const handle = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, 300);
    return () => clearTimeout(handle);
  }, [draft, value, onChange]);
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 64 64" className="size-9 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#0f2a4a" />
        <path d="M32 14 10 25l22 11 18-9v13h4V25L32 14Z" fill="#f59e0b" />
        <path d="M19 33v9c0 4 6 8 13 8s13-4 13-8v-9l-13 6-13-6Z" fill="#fff" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">GUTECH</div>
          <div className="text-[11px] font-medium tracking-wide opacity-75">LMS Portal</div>
        </div>
      )}
    </div>
  );
}
