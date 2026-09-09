import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { AuthLoading } from './ProtectedRoute';

export function RootRedirect() {
  const auth = useAuth();
  if (auth.status === 'loading') return <AuthLoading />;
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />;
  return <Navigate to={auth.profile?.mustChangePassword ? '/change-password' : '/trips'} replace />;
}
