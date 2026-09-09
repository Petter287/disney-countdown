import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RootRedirect } from '../features/auth/RootRedirect';
import { SessionShell } from '../features/auth/SessionShell';
import { AuthenticatedPlaceholderPage } from '../pages/AuthenticatedPlaceholderPage';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { LoginPage } from '../pages/LoginPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<SessionShell />}>
          <Route path="/trips" element={<AuthenticatedPlaceholderPage title="Mis viajes" />} />
          <Route path="/trips/:slug" element={<AuthenticatedPlaceholderPage title="Detalle del viaje" />} />
          <Route path="/trips/:slug/edit" element={<AuthenticatedPlaceholderPage title="Editar viaje" />} />
          <Route path="/trips/:slug/settings" element={<AuthenticatedPlaceholderPage title="Apariencia del viaje" />} />
          <Route path="/trips/:slug/participants" element={<AuthenticatedPlaceholderPage title="Participantes" />} />
          <Route path="/users" element={<AuthenticatedPlaceholderPage title="Usuarios del sistema" />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
