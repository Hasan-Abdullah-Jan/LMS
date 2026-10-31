import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/common/states';
import { homeFor } from '@/lib/roles';
import type { Role } from '@/lib/types';
import { ForbiddenPage } from '@/app/ErrorPages';
import { useAuth } from './AuthProvider';

/** Protected-route wrapper: logged-out visitors are sent to /login. */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <ForbiddenPage />;
  return <Outlet />;
}

/** Login & friends: signed-in users go straight to their dashboard. */
export function PublicOnly() {
  const { status, user } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (user)
    return (
      <Navigate to={user.mustChangePassword ? '/change-password' : homeFor(user.role)} replace />
    );
  return <Outlet />;
}

export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homeFor(user?.role)} replace />;
}
