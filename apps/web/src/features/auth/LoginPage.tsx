import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ChevronDown, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '@/components/common/misc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { homeFor } from '@/lib/roles';
import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './password';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email.')
    .pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Enter your password.'),
});
type Values = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@gutech.demo' },
  { role: 'Teacher', email: 'aisha.balushi@gutech.demo' },
  { role: 'Student', email: 'fatima.hinai@gutech.demo' },
];
const showDemo = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== 'false';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      const user = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(
        user.mustChangePassword
          ? '/change-password'
          : from && from !== '/'
            ? from
            : homeFor(user.role),
        { replace: true },
      );
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      description="Use the account issued by the registrar. There is no public sign-up."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="name@gutech.demo"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </FormField>
        <FormField id="password" label="Password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          {!isSubmitting && <LogIn />} Sign in
        </Button>
      </form>

      {showDemo && (
        <div className="rounded-lg border bg-muted/40 text-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2.5 font-medium"
            onClick={() => setDemoOpen((open) => !open)}
            aria-expanded={demoOpen}
          >
            Demo accounts
            <ChevronDown className={`size-4 transition ${demoOpen ? 'rotate-180' : ''}`} />
          </button>
          {demoOpen && (
            <div className="space-y-1 border-t px-3 py-2.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  type="button"
                  key={account.email}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    setValue('email', account.email, { shouldValidate: true });
                    setValue('password', 'Gutech@2026', { shouldValidate: true });
                  }}
                >
                  <span className="font-medium">{account.role}</span>
                  <span className="text-muted-foreground">{account.email}</span>
                </button>
              ))}
              <p className="px-2 pt-1 text-xs text-muted-foreground">
                Password for all demo accounts: Gutech@2026
              </p>
            </div>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
