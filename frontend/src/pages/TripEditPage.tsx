import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appRoutes } from '../app/routes';
import { useAuth } from '../features/auth/AuthProvider';
import { deleteTrip, loadTripManageDetail, updateTrip } from '../features/trips/api/trips-api';
import { TripEditorForm } from '../features/trips/components/TripEditorForm';
import { tripToForm } from '../features/trips/model/trip-form';
import type { TripManageDetail, TripMutationInput } from '../features/trips/model/trip';
import { useTrips } from '../features/trips/TripsProvider';
import { SessionExpiredError } from '../shared/api/supabase-functions';

export function TripEditPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { refresh } = useTrips();
  const [detail, setDetail] = useState<TripManageDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  const handleSessionExpired = async () => {
    await logout();
    navigate(appRoutes.login, { replace: true });
  };

  useEffect(() => {
    const currentGeneration = ++generation.current;
    setStatus('loading');
    setError('');

    void loadTripManageDetail(slug)
      .then((result) => {
        if (generation.current !== currentGeneration) return;
        setDetail(result);
        setStatus('ready');
      })
      .catch(async (loadError: unknown) => {
        if (generation.current !== currentGeneration) return;
        if (loadError instanceof SessionExpiredError) {
          await handleSessionExpired();
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el viaje.');
        setStatus('error');
      });

    return () => {
      generation.current += 1;
    };
  }, [slug]);

  const handleSubmit = async (input: TripMutationInput) => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const result = await updateTrip(detail.trip.slug, input);
      await refresh();
      navigate(appRoutes.trip(result.trip.slug), { replace: true });
    } catch (saveError) {
      if (saveError instanceof SessionExpiredError) {
        await handleSessionExpired();
        return;
      }
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el viaje.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    const confirmed = window.confirm(
      `¿Eliminar "${detail.trip.name}"? Esta acción también elimina su configuración, participantes e imagen de fondo.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError('');
    try {
      await deleteTrip(detail.trip.slug);
      await refresh();
      navigate(appRoutes.trips, { replace: true });
    } catch (deleteError) {
      if (deleteError instanceof SessionExpiredError) {
        await handleSessionExpired();
        return;
      }
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el viaje.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return <section className="workspace-card"><div className="inline-status">Cargando datos del viaje…</div></section>;
  }

  if (status === 'error' || !detail) {
    return (
      <section className="workspace-card compact-workspace">
        <div className="eyebrow">No se pudo editar el viaje</div>
        <h1>{error || 'Ocurrió un error inesperado.'}</h1>
        <Link className="secondary-button button-link" to={appRoutes.trips}>Volver a Mis viajes</Link>
      </section>
    );
  }

  return (
    <TripEditorForm
      key={detail.trip.id}
      title="Editar viaje"
      intro="Actualizá los datos generales, el destino y las fechas. La apariencia se gestiona por separado."
      initial={tripToForm(detail.trip)}
      initialTimezone={detail.settings.defaultTimezone}
      busy={busy}
      error={error}
      submitLabel="Guardar cambios"
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onCancel={() => navigate(appRoutes.trip(detail.trip.slug))}
    />
  );
}
