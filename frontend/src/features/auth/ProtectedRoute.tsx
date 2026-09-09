import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <AuthLoading />;
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (auth.profile?.mustChangePassword) return <Navigate to="/change-password" replace />;

  return <Outlet />;
}

export function AuthLoading() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-live="polite">
        <div className="auth-icon">🧳</div>
        <p className="eyebrow">Mis Viajes</p>
        <h1>Validando sesión…</h1>
        <p className="lead">Estamos comprobando tu sesión y acceso al sistema.</p>
      </section>
    </main>
  );
}
