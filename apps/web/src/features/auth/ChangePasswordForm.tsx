import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/common/misc';
import { Button } from '@/components/ui/button';
import { ApiError, errorMessage, getData } from '@/lib/api';
import type { Profile } from '@/lib/types';
import { useAuth } from './AuthProvider';
import { PasswordInput, passwordPolicy, PasswordStrength } from './password';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordPolicy,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a different password.',
  });
type Values = z.infer<typeof schema>;

export function ChangePasswordForm({
  onDone,
  submitLabel = 'Update password',
}: {
  onDone?: (user: Profile) => void;
  submitLabel?: string;
}) {
  const { updateUser } = useAuth();
  const { register, handleSubmit, control, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const newPassword = useWatch({ control, name: 'newPassword' }) ?? '';

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      const result = await getData<{ message: string; user: Profile }>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      updateUser(result.user);
      reset();
      toast.success('Password changed. Other devices have been signed out.');
      onDone?.(result.user);
    } catch (error) {
      if (error instanceof ApiError && error.details.length) {
        for (const detail of error.details) {
          if (detail.path === 'currentPassword' || detail.path === 'newPassword')
            setError(detail.path, { message: detail.message });
        }
      } else toast.error(errorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        id="currentPassword"
        label="Current password"
        error={formState.errors.currentPassword?.message}
      >
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          {...register('currentPassword')}
          aria-invalid={!!formState.errors.currentPassword}
        />
      </FormField>
      <FormField
        id="newPassword"
        label="New password"
        error={formState.errors.newPassword?.message}
      >
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
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
      <Button type="submit" loading={formState.isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
