import { Navigate, Outlet } from 'react-router-dom';
import { appRoutes } from '../../app/routes';
import { useAuth } from './AuthProvider';

export function SystemOwnerRoute() {
  const { profile } = useAuth();

  if (!profile?.systemOwner) {
    return <Navigate to={appRoutes.trips} replace />;
  }

  return <Outlet />;
}
