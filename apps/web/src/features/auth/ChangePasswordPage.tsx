import { KeyRound, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { homeFor } from '@/lib/roles';
import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';
import { ChangePasswordForm } from './ChangePasswordForm';

/** Forced on first sign-in with an admin-issued temporary password. */
export function ChangePasswordPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <AuthLayout
      title="Set your own password"
      description={`Welcome${user ? `, ${user.fullName.split(' ')[0]}` : ''}! You signed in with a temporary password. Choose a new one to continue.`}
    >
      <div className="flex items-center gap-2 rounded-lg border bg-accent/60 p-3 text-sm text-accent-foreground">
        <KeyRound className="size-4 shrink-0" /> For your security, the portal stays locked until
        you do this.
      </div>
      <ChangePasswordForm
        submitLabel="Save and continue"
        onDone={(u) => navigate(homeFor(u.role), { replace: true })}
      />
      <Button variant="ghost" className="w-full" onClick={() => void logout()}>
        <LogOut /> Sign out
      </Button>
    </AuthLayout>
  );
}
