import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { roleHome } from '../lib/roles';

export default function ProtectedRoute({ roles }: { roles?: Array<'admin' | 'teacher' | 'student'> }) {
  const { profile, loading } = useAuth();
  if (loading) return <div className="screen-state" role="status">Loading your workspace…</div>;
  if (!profile) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={roleHome(profile.role)} replace />;
  return <Outlet />;
}

