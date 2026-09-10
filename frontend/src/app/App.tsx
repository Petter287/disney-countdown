import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RootRedirect } from '../features/auth/RootRedirect';
import { SessionShell } from '../features/auth/SessionShell';
import { SystemOwnerRoute } from '../features/auth/SystemOwnerRoute';
import { TripPermissionRoute } from '../features/trips/TripPermissionRoute';
import { TripsProvider } from '../features/trips/TripsProvider';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { SystemUsersPage } from '../pages/SystemUsersPage';
import { TripCreatePage } from '../pages/TripCreatePage';
import { TripDetailPage } from '../pages/TripDetailPage';
import { TripEditPage } from '../pages/TripEditPage';
import { TripParticipantsPage } from '../pages/TripParticipantsPage';
import { TripSettingsPage } from '../pages/TripSettingsPage';
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
            <Route element={<TripPermissionRoute permission="trip.edit" />}>
              <Route path="/trips/:slug/settings" element={<TripSettingsPage />} />
            </Route>
            <Route element={<TripPermissionRoute permission="members.manage" />}>
              <Route path="/trips/:slug/participants" element={<TripParticipantsPage />} />
            </Route>
          </Route>
          <Route element={<SystemOwnerRoute />}>
            <Route path="/users" element={<SystemUsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
