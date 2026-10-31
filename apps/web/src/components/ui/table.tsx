import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Table({
  className,
  wrapperClassName,
  ...props
}: ComponentProps<'table'> & { wrapperClassName?: string }) {
  return (
    <div
      className={cn('relative w-full overflow-x-auto rounded-xl border bg-card', wrapperClassName)}
    >
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}
export const TableHeader = ({ className, ...props }: ComponentProps<'thead'>) => (
  <thead className={cn('bg-muted/60 [&_tr]:border-b', className)} {...props} />
);
export const TableBody = ({ className, ...props }: ComponentProps<'tbody'>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);
export const TableRow = ({ className, ...props }: ComponentProps<'tr'>) => (
  <tr className={cn('border-b transition-colors hover:bg-muted/40', className)} {...props} />
);
export const TableHead = ({ className, ...props }: ComponentProps<'th'>) => (
  <th
    className={cn(
      'h-10 px-3 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase',
      className,
    )}
    {...props}
  />
);
export const TableCell = ({ className, ...props }: ComponentProps<'td'>) => (
  <td className={cn('px-3 py-3 align-middle', className)} {...props} />
);
