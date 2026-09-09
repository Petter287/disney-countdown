import { Route, Routes } from 'react-router-dom';
import { FoundationPage } from '../pages/FoundationPage';
import { MigrationPlaceholderPage } from '../pages/MigrationPlaceholderPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      <Route path="/login" element={<MigrationPlaceholderPage title="Autenticación" />} />
      <Route path="/trips" element={<MigrationPlaceholderPage title="Mis viajes" />} />
      <Route path="/trips/:slug" element={<MigrationPlaceholderPage title="Detalle del viaje" />} />
      <Route path="/trips/:slug/edit" element={<MigrationPlaceholderPage title="Editar viaje" />} />
      <Route path="/trips/:slug/settings" element={<MigrationPlaceholderPage title="Apariencia del viaje" />} />
      <Route path="/trips/:slug/participants" element={<MigrationPlaceholderPage title="Participantes" />} />
      <Route path="/users" element={<MigrationPlaceholderPage title="Usuarios del sistema" />} />
      <Route path="*" element={<FoundationPage />} />
    </Routes>
  );
}
