import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { appRoutes } from '../app/routes';
import { useAuth } from '../features/auth/AuthProvider';
import { SessionExpiredError } from '../shared/api/supabase-functions';
import { TripCountdown } from '../features/trips/components/TripCountdown';
import { loadTripDetail } from '../features/trips/api/trips-api';
import { useTrips } from '../features/trips/TripsProvider';
import { formatTripDate, formatTripDestination } from '../features/trips/model/trip-format';
import type { TripDetail } from '../features/trips/model/trip';

function safeHttpsUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function TripDetailPage() {
  const { slug = '' } = useParams();
  const { profile, logout } = useAuth();
  const { status: tripsStatus, findAccess } = useTrips();
  const access = useMemo(() => findAccess(slug), [findAccess, slug]);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    if (tripsStatus !== 'ready' || !access) return;
    const currentGeneration = ++generation.current;
    setStatus('loading');
    setError('');

    void loadTripDetail(access.trip.slug)
      .then((result) => {
        if (generation.current !== currentGeneration) return;
        setDetail(result);
        setStatus('ready');
      })
      .catch(async (loadError: unknown) => {
        if (generation.current !== currentGeneration) return;
        if (loadError instanceof SessionExpiredError) {
          await logout();
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el viaje.');
        setStatus('error');
      });

    return () => {
      generation.current += 1;
    };
  }, [access, logout, tripsStatus]);

  if (tripsStatus === 'loading') {
    return <section className="workspace-card"><div className="inline-status">Cargando viaje…</div></section>;
  }

  if (tripsStatus === 'ready' && !access) {
    return (
      <section className="workspace-card compact-workspace">
        <div className="eyebrow">Acceso denegado</div>
        <h1>Ese viaje no está disponible para tu usuario.</h1>
        <Link className="secondary-button button-link" to={appRoutes.trips}>Volver a Mis viajes</Link>
      </section>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return <section className="workspace-card"><div className="inline-status">Cargando cuenta regresiva…</div></section>;
  }

  if (status === 'error' || !detail || !access) {
    return (
      <section className="workspace-card compact-workspace">
        <div className="eyebrow">No se pudo abrir el viaje</div>
        <h1>{error || 'Ocurrió un error inesperado.'}</h1>
        <Link className="secondary-button button-link" to={appRoutes.trips}>Volver a Mis viajes</Link>
      </section>
    );
  }

  const permissions = detail.permissions.length ? detail.permissions : access.permissions;
  const settings = detail.settings;
  const backgroundUrl = safeHttpsUrl(settings.backgroundUrl);
  const role = access.membership?.role?.name || (profile?.systemOwner ? 'System Owner' : 'Sin rol');

  return (
    <div className="trip-detail-page">
      <nav className="trip-toolbar" aria-label="Acciones del viaje">
        <Link className="secondary-button button-link" to={appRoutes.trips}>🌎 Mis viajes</Link>
        <div className="trip-toolbar-actions">
          {permissions.includes('trip.edit') ? (
            <Link className="secondary-button button-link" to={appRoutes.tripSettings(access.trip.slug)}>🎨 Apariencia</Link>
          ) : null}
          {permissions.includes('members.manage') ? (
            <Link className="secondary-button button-link" to={appRoutes.tripParticipants(access.trip.slug)}>👥 Participantes</Link>
          ) : null}
          {profile?.systemOwner ? (
            <Link className="secondary-button button-link" to={appRoutes.tripEdit(access.trip.slug)}>✨ Mi viaje</Link>
          ) : null}
        </div>
      </nav>

      <section className="trip-hero">
        {backgroundUrl ? <img className="trip-hero-background" src={backgroundUrl} alt="" aria-hidden="true" /> : null}
        <div className="trip-hero-overlay" />
        <div className="trip-hero-content">
          <div className="eyebrow">{settings.eyebrow || 'Próximo viaje'}</div>
          <h1>{settings.title}</h1>
          {settings.subtitle ? <p className="trip-subtitle">{settings.subtitle}</p> : null}
          <TripCountdown settings={settings} />
          {settings.photoCredit ? <p className="photo-credit">{settings.photoCredit}</p> : null}
        </div>
      </section>

      <section className="trip-info-grid" aria-label="Información del viaje">
        <article className="trip-info-card">
          <span>Destino</span>
          <strong>{formatTripDestination(access.trip)}</strong>
        </article>
        <article className="trip-info-card">
          <span>Inicio</span>
          <strong>{formatTripDate(access.trip.startsOn)}</strong>
        </article>
        <article className="trip-info-card">
          <span>Fin</span>
          <strong>{formatTripDate(access.trip.endsOn)}</strong>
        </article>
        <article className="trip-info-card">
          <span>Tu acceso</span>
          <strong>{role}</strong>
        </article>
      </section>
    </div>
  );
}
