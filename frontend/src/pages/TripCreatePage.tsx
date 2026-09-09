import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appRoutes } from '../app/routes';
import { useAuth } from '../features/auth/AuthProvider';
import { createTrip } from '../features/trips/api/trips-api';
import { TripEditorForm } from '../features/trips/components/TripEditorForm';
import { emptyTripForm } from '../features/trips/model/trip-form';
import type { TripMutationInput } from '../features/trips/model/trip';
import { useTrips } from '../features/trips/TripsProvider';
import { SessionExpiredError } from '../shared/api/supabase-functions';

export function TripCreatePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { refresh } = useTrips();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (input: TripMutationInput) => {
    setBusy(true);
    setError('');
    try {
      const result = await createTrip(input);
      await refresh();
      navigate(appRoutes.trip(result.trip.slug), { replace: true });
    } catch (saveError) {
      if (saveError instanceof SessionExpiredError) {
        await logout();
        navigate(appRoutes.login, { replace: true });
        return;
      }
      setError(saveError instanceof Error ? saveError.message : 'No se pudo crear el viaje.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <TripEditorForm
      title="Nuevo viaje"
      intro="Elegí la ubicación y las fechas. La zona horaria del destino se calcula automáticamente."
      initial={emptyTripForm()}
      busy={busy}
      error={error}
      submitLabel="Crear viaje"
      onSubmit={handleSubmit}
      onCancel={() => navigate(appRoutes.trips)}
    />
  );
}
