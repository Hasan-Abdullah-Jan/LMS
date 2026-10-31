import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '@/components/common/misc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, getData } from '@/lib/api';
import { AuthLayout } from './AuthLayout';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email.')
    .pipe(z.email('Enter a valid email address.')),
});

export function ForgotPasswordPage() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      const result = await getData<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        skipRefresh: true,
      });
      setSentMessage(result.message);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (sentMessage) {
    return (
      <AuthLayout title="Check your inbox">
        <div className="space-y-4 rounded-xl border bg-card p-5 text-sm" role="status">
          <MailCheck className="size-8 text-success" aria-hidden />
          <p>{sentMessage}</p>
          <p className="text-muted-foreground">
            Didn&apos;t get it? Check your spam folder or try again in a few minutes.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your account email and we'll send you a secure reset link."
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
        <FormField id="email" label="Email" error={formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            {...register('email')}
            aria-invalid={!!formState.errors.email}
          />
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
          Send reset link
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
