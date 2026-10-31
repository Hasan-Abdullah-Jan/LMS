import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** "2d 4h left" / "Overdue by 3h", refreshed every 30s. */
export function DueCountdown({ dueAt, className }: { dueAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(dueAt).getTime() - now;
  const { d, h, m } = parts(Math.abs(diff));
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  const urgent = diff > 0 && diff < 24 * 3600 * 1000;
  return (
    <span
      className={cn(
        'text-xs font-medium tabular-nums',
        diff < 0 ? 'text-destructive' : urgent ? 'text-warning' : 'text-muted-foreground',
        className,
      )}
    >
      {diff < 0 ? `Overdue by ${text}` : `${text} left`}
    </span>
  );
}

/** mm:ss timer used by the quiz runner. */
export function formatClock(ms: number): string {
  const { d, h, m, s } = parts(ms);
  const hours = d * 24 + h;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
