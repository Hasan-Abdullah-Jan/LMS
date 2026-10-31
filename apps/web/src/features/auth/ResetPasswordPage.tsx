import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '@/components/common/misc';
import { Button } from '@/components/ui/button';
import { ApiError, errorMessage, getData } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { PasswordInput, passwordPolicy, PasswordStrength } from './password';

const schema = z
  .object({ newPassword: passwordPolicy, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  });

/** Read the recovery token Supabase puts in the URL fragment, then scrub it from history. */
function readRecoveryFragment(): { token: string | null; expired: boolean } {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('type') === 'recovery' ? params.get('access_token') : null;
  const expired = Boolean(params.get('error_code') || params.get('error'));
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  return { token, expired };
}

export function ResetPasswordPage() {
  const [{ token, expired }] = useState(readRecoveryFragment);
  const [state, setState] = useState<'form' | 'done' | 'invalid'>(
    token && !expired ? 'form' : 'invalid',
  );
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirm: '' },
  });
  const newPassword = useWatch({ control, name: 'newPassword' }) ?? '';

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setError(null);
    try {
      await getData('/auth/reset-password', {
        method: 'POST',
        body: { newPassword },
        token: token!,
        skipRefresh: true,
      });
      setState('done');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LINK_INVALID') setState('invalid');
      else setError(errorMessage(err));
    }
  });

  if (state === 'invalid') {
    return (
      <AuthLayout title="This link has expired">
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-5 text-sm"
        >
          <LinkIcon className="size-7 text-warning" aria-hidden />
          <p>
            This password reset link is invalid, has expired or has already been used. Reset links
            work once and expire after 1 hour.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (state === 'done') {
    return (
      <AuthLayout title="Password updated">
        <div role="status" className="space-y-3 rounded-xl border bg-card p-5 text-sm">
          <CheckCircle2 className="size-8 text-success" aria-hidden />
          <p>
            Your password has been reset and every other session was signed out. Sign in with your
            new password.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description="Pick something you haven't used here before."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <FormField
          id="newPassword"
          label="New password"
          error={formState.errors.newPassword?.message}
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            autoFocus
            {...register('newPassword')}
            aria-invalid={!!formState.errors.newPassword}
          />
        </FormField>
        <PasswordStrength password={newPassword} />
        <FormField
          id="confirm"
          label="Confirm new password"
          error={formState.errors.confirm?.message}
        >
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            {...register('confirm')}
            aria-invalid={!!formState.errors.confirm}
          />
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
