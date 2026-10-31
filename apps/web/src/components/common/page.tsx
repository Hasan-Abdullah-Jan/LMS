import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="mb-6 space-y-3">
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.7rem]">
            {title}
          </h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label="Pagination"
      className={cn('mt-4 flex items-center justify-between gap-3 text-sm', className)}
    >
      <p className="text-muted-foreground">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft /> Previous
        </Button>
        <span className="text-muted-foreground tabular-nums">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
        >
          Next <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  to,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: typeof ChevronLeft;
  tone?: 'primary' | 'brand' | 'success' | 'warning' | 'info' | 'danger';
  to?: string;
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    brand: 'bg-brand/15 text-accent-foreground',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/15 text-[oklch(0.5_0.12_60)] dark:text-warning',
    info: 'bg-info/12 text-info',
    danger: 'bg-destructive/10 text-destructive',
  } as const;
  const body = (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-card p-5 shadow-xs transition hover:shadow-sm">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tones[tone])}
      >
        <Icon className="size-5" aria-hidden />
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      {body}
    </Link>
  ) : (
    body
  );
}
