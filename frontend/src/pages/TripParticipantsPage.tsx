import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { appRoutes } from '../app/routes';
import { useAuth } from '../features/auth/AuthProvider';
import {
  assignTripParticipant,
  loadTripParticipants,
  removeTripParticipant,
  updateTripParticipantRole,
} from '../features/trips/api/participants-api';
import type { TripParticipantsData } from '../features/trips/model/participant';
import {
  availableParticipantIdentity,
  defaultParticipantRole,
  participantIdentity,
  participantRoleCode,
  summarizeParticipants,
} from '../features/trips/model/participant-utils';
import { useTrips } from '../features/trips/TripsProvider';
import { SessionExpiredError } from '../shared/api/supabase-functions';

type NoticeTone = '' | 'ok' | 'error';

interface Notice {
  text: string;
  tone: NoticeTone;
}

const EMPTY_DATA: TripParticipantsData = {
  roles: [],
  members: [],
  availableUsers: [],
};

export function TripParticipantsPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { status: tripsStatus, findAccess } = useTrips();
  const access = useMemo(() => findAccess(slug), [findAccess, slug]);
  const [data, setData] = useState<TripParticipantsData>(EMPTY_DATA);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadError, setLoadError] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState('');
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({ text: '', tone: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    if (tripsStatus !== 'ready' || !access) return;
    const requestGeneration = ++generation.current;
    setLoadStatus('loading');
    setLoadError('');
    setNotice({ text: '', tone: '' });

    void loadTripParticipants(access.trip.slug)
      .then((result) => {
        if (generation.current !== requestGeneration) return;
        setData(result);
        setSelectedUserIds(new Set());
        setSelectedRole(defaultParticipantRole(result.roles));
        setRoleDrafts({});
        setLoadStatus('ready');
      })
      .catch(async (error: unknown) => {
        if (generation.current !== requestGeneration) return;
        if (error instanceof SessionExpiredError) {
          await logout();
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los participantes.');
        setLoadStatus('error');
      });

    return () => {
      generation.current += 1;
    };
  }, [access, logout, reloadKey, tripsStatus]);

  const busy = busyAction !== null;
  const summary = useMemo(
    () => summarizeParticipants(data.members, data.availableUsers),
    [data.availableUsers, data.members],
  );

  const replaceData = (nextData: TripParticipantsData) => {
    setData(nextData);
    setSelectedUserIds(new Set());
    setRoleDrafts({});
    setSelectedRole((current) => (
      nextData.roles.some((role) => role.code === current)
        ? current
        : defaultParticipantRole(nextData.roles)
    ));
  };

  const refreshAfterMutation = async (requestGeneration: number) => {
    if (!access) return null;
    const nextData = await loadTripParticipants(access.trip.slug);
    if (generation.current !== requestGeneration) return null;
    replaceData(nextData);
    return nextData;
  };

  const handleRoleChange = async (userId: string, nextRole: string) => {
    if (!access || busy) return;
    const requestGeneration = generation.current;
    setRoleDrafts((current) => ({ ...current, [userId]: nextRole }));
    setBusyAction(`role:${userId}`);
    setNotice({ text: 'Actualizando rol…', tone: '' });

    try {
      await updateTripParticipantRole(access.trip.slug, userId, nextRole);
      if (generation.current !== requestGeneration) return;
      await refreshAfterMutation(requestGeneration);
      if (generation.current === requestGeneration) {
        setNotice({ text: 'Rol actualizado.', tone: 'ok' });
      }
    } catch (error) {
      if (generation.current !== requestGeneration) return;
      setRoleDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
      if (error instanceof SessionExpiredError) {
        await logout();
        return;
      }
      setNotice({
        text: error instanceof Error ? error.message : 'No se pudo actualizar el rol.',
        tone: 'error',
      });
    } finally {
      if (generation.current === requestGeneration) setBusyAction(null);
    }
  };

  const handleRemove = async (userId: string, identity: string) => {
    if (!access || busy) return;
    if (!window.confirm(`¿Quitar a ${identity} de este viaje?`)) return;

    const requestGeneration = generation.current;
    setBusyAction(`remove:${userId}`);
    setNotice({ text: 'Quitando participante…', tone: '' });

    try {
      await removeTripParticipant(access.trip.slug, userId);
      if (generation.current !== requestGeneration) return;
      await refreshAfterMutation(requestGeneration);
      if (generation.current === requestGeneration) {
        setNotice({ text: 'Participante quitado del viaje.', tone: 'ok' });
      }
    } catch (error) {
      if (generation.current !== requestGeneration) return;
      if (error instanceof SessionExpiredError) {
        await logout();
        return;
      }
      setNotice({
        text: error instanceof Error ? error.message : 'No se pudo quitar al participante.',
        tone: 'error',
      });
    } finally {
      if (generation.current === requestGeneration) setBusyAction(null);
    }
  };

  const handleAvailableToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.currentTarget;
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
    setNotice({ text: '', tone: '' });
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access || busy) return;

    const selected = [...selectedUserIds];
    if (!selected.length) {
      setNotice({ text: 'Seleccioná al menos un usuario.', tone: 'error' });
      return;
    }
    if (!selectedRole || !data.roles.some((role) => role.code === selectedRole)) {
      setNotice({ text: 'Seleccioná un rol válido.', tone: 'error' });
      return;
    }

    const requestGeneration = generation.current;
    setBusyAction('add');
    setNotice({
      text: selected.length === 1 ? 'Agregando participante…' : 'Agregando participantes…',
      tone: '',
    });

    try {
      const results = await Promise.allSettled(
        selected.map((userId) => assignTripParticipant(access.trip.slug, userId, selectedRole)),
      );
      if (generation.current !== requestGeneration) return;

      const sessionFailure = results.find(
        (result) => result.status === 'rejected' && result.reason instanceof SessionExpiredError,
      );
      if (sessionFailure) {
        await logout();
        return;
      }

      const successful = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - successful;
      await refreshAfterMutation(requestGeneration);
      if (generation.current !== requestGeneration) return;

      if (!failed) {
        setNotice({
          text: successful === 1 ? 'Participante agregado.' : `${successful} participantes agregados.`,
          tone: 'ok',
        });
      } else {
        const firstFailure = results.find((result) => result.status === 'rejected');
        const detail = firstFailure?.status === 'rejected' && firstFailure.reason instanceof Error
          ? ` ${firstFailure.reason.message}`
          : '';
        setNotice({
          text: `${successful} agregados y ${failed} sin agregar.${detail}`,
          tone: 'error',
        });
      }
    } catch (error) {
      if (generation.current !== requestGeneration) return;
      if (error instanceof SessionExpiredError) {
        await logout();
        return;
      }
      setNotice({
        text: error instanceof Error ? error.message : 'No se pudieron agregar los participantes.',
        tone: 'error',
      });
    } finally {
      if (generation.current === requestGeneration) setBusyAction(null);
    }
  };

  if (tripsStatus !== 'ready' || loadStatus === 'idle' || loadStatus === 'loading') {
    return <section className="workspace-card"><div className="inline-status">Cargando participantes…</div></section>;
  }

  if (loadStatus === 'error' || !access) {
    return (
      <section className="workspace-card compact-workspace">
        <div className="eyebrow">Participantes</div>
        <h1>No se pudo abrir la administración del viaje.</h1>
        <p className="lead">{loadError || 'El viaje ya no está disponible.'}</p>
        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={() => setReloadKey((value) => value + 1)}>Reintentar</button>
          <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.trips)}>Volver a Mis viajes</button>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-card trip-participants-page">
      <div className="page-heading participants-heading">
        <div>
          <div className="eyebrow">👥 Administración del viaje</div>
          <h1>Participantes</h1>
          <p className="lead">{access.trip.name}</p>
        </div>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => navigate(appRoutes.trip(access.trip.slug))}>
          Volver al viaje
        </button>
      </div>

      <div className="participant-summary-grid" aria-label="Resumen de participantes">
        <article className="participant-summary-card">
          <strong>{summary.total}</strong>
          <span>Participantes</span>
        </article>
        <article className="participant-summary-card">
          <strong>{summary.active}</strong>
          <span>Con acceso activo</span>
        </article>
        <article className="participant-summary-card">
          <strong>{summary.available}</strong>
          <span>Disponibles para agregar</span>
        </article>
      </div>

      {notice.text ? (
        <div className={`participant-notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
          {notice.text}
        </div>
      ) : null}

      <div className="participants-layout">
        <section className="participant-section" aria-labelledby="currentParticipantsTitle">
          <div className="participant-section-heading">
            <div>
              <h2 id="currentParticipantsTitle">Participantes actuales</h2>
              <p>Cambiá el rol o quitá participantes del viaje.</p>
            </div>
          </div>

          <div className="participant-members-list">
            {data.members.length === 0 ? (
              <div className="participant-empty">Todavía no hay participantes en este viaje.</div>
            ) : data.members.map((member) => {
              const identity = participantIdentity(member);
              const roleCode = roleDrafts[member.userId] ?? participantRoleCode(member, data.roles);
              return (
                <article className="participant-member-row" key={member.userId}>
                  <div className="participant-member-main">
                    <div className="participant-member-identity">
                      <strong>{identity}</strong>
                      <span>{member.profile.email}</span>
                    </div>
                    <div className="participant-badges">
                      {member.isOwner ? <span className="participant-badge">Propietario</span> : null}
                      {member.profile.enabled === false ? <span className="participant-badge muted">Acceso global deshabilitado</span> : null}
                    </div>
                  </div>

                  {!member.isOwner ? (
                    <div className="participant-member-actions">
                      <label>
                        <span className="visually-hidden">Rol de {identity}</span>
                        <select
                          value={roleCode}
                          aria-label={`Rol de ${identity}`}
                          disabled={busy}
                          onChange={(event) => void handleRoleChange(member.userId, event.currentTarget.value)}
                        >
                          {data.roles.map((role) => <option key={role.id} value={role.code}>{role.name}</option>)}
                        </select>
                      </label>
                      <button
                        className="danger-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRemove(member.userId, identity)}
                      >
                        Quitar del viaje
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="participant-section" aria-labelledby="addParticipantsTitle">
          <div className="participant-section-heading">
            <div>
              <h2 id="addParticipantsTitle">Agregar participantes</h2>
              <p>Solo aparecen usuarios existentes con acceso global activo que todavía no pertenecen al viaje.</p>
            </div>
          </div>

          <form className="participant-add-form" onSubmit={handleAdd}>
            <fieldset disabled={busy || data.availableUsers.length === 0}>
              <legend>Usuarios disponibles</legend>
              <div className="participant-available-list">
                {data.availableUsers.length === 0 ? (
                  <div className="participant-empty">No hay usuarios activos disponibles para agregar.</div>
                ) : data.availableUsers.map((user) => {
                  const identity = availableParticipantIdentity(user);
                  return (
                    <label className="participant-available-user" key={user.id}>
                      <input
                        type="checkbox"
                        value={user.id}
                        checked={selectedUserIds.has(user.id)}
                        onChange={handleAvailableToggle}
                      />
                      <span>
                        <strong>{identity}</strong>
                        <small>{user.email}</small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <label className="participant-role-field">
                <span>Rol para seleccionados</span>
                <select
                  required
                  value={selectedRole}
                  onChange={(event) => {
                    setSelectedRole(event.currentTarget.value);
                    setNotice({ text: '', tone: '' });
                  }}
                >
                  {data.roles.map((role) => <option key={role.id} value={role.code}>{role.name}</option>)}
                </select>
              </label>

              <button className="primary-button participant-add-button" type="submit" disabled={busy || !data.availableUsers.length || !data.roles.length}>
                {selectedUserIds.size > 1 ? `Agregar ${selectedUserIds.size} seleccionados` : 'Agregar seleccionados'}
              </button>
            </fieldset>
          </form>
        </section>
      </div>
    </section>
  );
}
