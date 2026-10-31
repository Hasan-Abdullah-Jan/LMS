import { Compass, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeFor } from '@/lib/roles';

function ErrorScreen({
  code,
  title,
  message,
  icon: Icon,
}: {
  code: string;
  title: string;
  message: string;
  icon: typeof Compass;
}) {
  const { user } = useAuth();
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-7" aria-hidden />
      </div>
      <p className="text-sm font-semibold tracking-widest text-muted-foreground">{code}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button asChild className="mt-6">
        <Link to={user ? homeFor(user.role) : '/login'}>
          {user ? 'Go to my dashboard' : 'Go to sign in'}
        </Link>
      </Button>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorScreen
      code="404"
      title="Page not found"
      message="The page you're looking for doesn't exist or has moved."
      icon={Compass}
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorScreen
      code="403"
      title="Access denied"
      message="Your role doesn't have access to this page."
      icon={ShieldAlert}
    />
  );
}
