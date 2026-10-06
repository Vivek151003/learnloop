import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@learnloop/shared';
import { homeFor, useAuth } from '../lib/auth';
import { Spinner } from './ui';

function FullPageSpinner() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center text-brand-600">
      <Spinner className="h-8 w-8" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** UI-side role check (FR-3). The API enforces the same rule on every request. */
export function RequireRole({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}
