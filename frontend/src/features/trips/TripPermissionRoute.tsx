import { Link, Outlet, useParams } from 'react-router-dom';
import { appRoutes } from '../../app/routes';
import { useTrips } from './TripsProvider';
import type { TripPermission } from './model/trip';

export function TripPermissionRoute({ permission }: { permission: TripPermission }) {
  const { slug = '' } = useParams();
  const { status, findAccess } = useTrips();

  if (status === 'loading') {
    return <section className="workspace-card"><div className="inline-status">Validando acceso…</div></section>;
  }

  const access = status === 'ready' ? findAccess(slug) : null;
  if (!access || !access.permissions.includes(permission)) {
    return (
      <section className="workspace-card compact-workspace">
        <div className="eyebrow">Acceso denegado</div>
        <h1>No tenés permiso para abrir esta sección.</h1>
        <p className="lead">El backend vuelve a validar el permiso antes de aceptar cualquier cambio.</p>
        <Link className="secondary-button button-link" to={access ? appRoutes.trip(access.trip.slug) : appRoutes.trips}>
          Volver
        </Link>
      </section>
    );
  }

  return <Outlet />;
}
