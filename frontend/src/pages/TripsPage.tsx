import { Link } from 'react-router-dom';
import { appRoutes } from '../app/routes';
import { useAuth } from '../features/auth/AuthProvider';
import { useTrips } from '../features/trips/TripsProvider';
import { formatTripDestination } from '../features/trips/model/trip-format';

function displayName(displayName?: string | null, email?: string) {
  return displayName?.trim() || email?.split('@')[0] || 'viajero';
}

export function TripsPage() {
  const { profile } = useAuth();
  const { status, error, accessibleTrips, refresh } = useTrips();

  return (
    <section className="workspace-card trips-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Tu próximo destino</div>
          <h1>Hola, {displayName(profile?.displayName, profile?.email)} 👋</h1>
          <p className="lead">Elegí un viaje para abrir su cuenta regresiva y configuración.</p>
        </div>
        {profile?.systemOwner ? (
          <div className="page-actions">
            <Link className="secondary-button button-link" to={appRoutes.users}>Usuarios</Link>
            <Link className="primary-button button-link" to={appRoutes.tripNew}>+ Nuevo viaje</Link>
          </div>
        ) : null}
      </div>

      {status === 'loading' ? <div className="inline-status">Cargando viajes…</div> : null}

      {status === 'error' ? (
        <div className="inline-status error">
          <span>{error}</span>
          <button className="secondary-button" type="button" onClick={() => void refresh()}>Reintentar</button>
        </div>
      ) : null}

      {status === 'ready' && accessibleTrips.length === 0 ? (
        <div className="empty-state">
          <strong>No tenés viajes disponibles.</strong>
          <span>Cuando te asignen a un viaje, va a aparecer acá.</span>
        </div>
      ) : null}

      {status === 'ready' && accessibleTrips.length > 0 ? (
        <div className="trip-grid">
          {accessibleTrips.map((access) => {
            const { trip } = access;
            const role = access.membership?.role?.name || (profile?.systemOwner ? 'System Owner' : 'Sin rol');
            return (
              <article className="trip-card" key={trip.id}>
                <div className="trip-card-top">
                  <div>
                    <div className="trip-card-icon">✈️</div>
                    <h2>{trip.name}</h2>
                  </div>
                  <span className="trip-role">{role}</span>
                </div>
                <p className="trip-destination">{formatTripDestination(trip)}</p>
                <div className="trip-card-actions">
                  <Link className="primary-button button-link" to={appRoutes.trip(trip.slug)}>Abrir viaje →</Link>
                  {access.permissions.includes('trip.edit') ? (
                    <Link className="secondary-button button-link" to={appRoutes.tripSettings(trip.slug)}>Apariencia</Link>
                  ) : null}
                  {profile?.systemOwner ? (
                    <Link className="secondary-button button-link" to={appRoutes.tripEdit(trip.slug)}>Editar</Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
