import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RootRedirect } from '../features/auth/RootRedirect';
import { SessionShell } from '../features/auth/SessionShell';
import { SystemOwnerRoute } from '../features/auth/SystemOwnerRoute';
import { TripsProvider } from '../features/trips/TripsProvider';
import { AuthenticatedPlaceholderPage } from '../pages/AuthenticatedPlaceholderPage';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { TripCreatePage } from '../pages/TripCreatePage';
import { TripDetailPage } from '../pages/TripDetailPage';
import { TripEditPage } from '../pages/TripEditPage';
import { TripsPage } from '../pages/TripsPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<SessionShell />}>
          <Route element={<TripsProvider />}>
            <Route path="/trips" element={<TripsPage />} />
            <Route element={<SystemOwnerRoute />}>
              <Route path="/trips/new" element={<TripCreatePage />} />
              <Route path="/trips/:slug/edit" element={<TripEditPage />} />
            </Route>
            <Route path="/trips/:slug" element={<TripDetailPage />} />
            <Route path="/trips/:slug/settings" element={<AuthenticatedPlaceholderPage title="Apariencia del viaje" />} />
            <Route path="/trips/:slug/participants" element={<AuthenticatedPlaceholderPage title="Participantes" />} />
          </Route>
          <Route path="/users" element={<AuthenticatedPlaceholderPage title="Usuarios del sistema" />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
