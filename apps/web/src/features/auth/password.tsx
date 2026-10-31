import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Mirrors the API policy: 10+ characters with at least one letter and one number. */
export const passwordPolicy = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(72, 'Use at most 72 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function passwordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 14) score += 1;
  return score;
}

const LEVELS = [
  { label: 'Too weak', color: 'bg-destructive' },
  { label: 'Weak', color: 'bg-destructive' },
  { label: 'Fair', color: 'bg-warning' },
  { label: 'Good', color: 'bg-info' },
  { label: 'Strong', color: 'bg-success' },
];

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  const level = LEVELS[score]!;
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={cn(
              'h-1.5 flex-1 rounded-full bg-muted transition-colors',
              score >= step && level.color,
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength:{' '}
        <span className="font-medium text-foreground">{password ? level.label : '—'}</span> · at
        least 10 characters with a letter and a number
      </p>
    </div>
  );
}
