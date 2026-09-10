import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { appRoutes } from '../app/routes';
import { useAuth } from '../features/auth/AuthProvider';
import {
  createSystemUser,
  loadSystemUsers,
  toggleSystemUserAccess,
  updateSystemUser,
} from '../features/users/api/system-users-api';
import {
  assignmentsFromDraft,
  buildAssignmentDraft,
  validateSystemUserForm,
  type AssignmentDraft,
  type SystemUserFormValues,
} from '../features/users/model/system-user-form';
import type { SystemUser, SystemUsersPayload } from '../features/users/model/system-user';
import { SessionExpiredError } from '../shared/api/supabase-functions';

const EMPTY_FORM: SystemUserFormValues = {
  displayName: '',
  email: '',
  temporaryPassword: '',
  enabled: true,
};

function userIdentity(user: SystemUser) {
  return user.displayName?.trim() || user.email;
}

function normalizePayload(payload: SystemUsersPayload): SystemUsersPayload {
  return {
    users: (payload.users || []).map((user) => ({
      ...user,
      memberships: Array.isArray(user.memberships) ? user.memberships : [],
    })),
    trips: Array.isArray(payload.trips) ? payload.trips : [],
    roles: Array.isArray(payload.roles) ? payload.roles : [],
  };
}

function fallbackRole(payload: SystemUsersPayload | null) {
  return payload?.roles.find((role) => role.code === 'viewer')?.code || payload?.roles[0]?.code || 'viewer';
}

export function SystemUsersPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [data, setData] = useState<SystemUsersPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<SystemUserFormValues>(EMPTY_FORM);
  const [assignments, setAssignments] = useState<AssignmentDraft>({});
  const [busy, setBusy] = useState(false);
  const [pageMessage, setPageMessage] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const generation = useRef(0);
  const loadSequence = useRef(0);

  const editingUser = useMemo(
    () => data?.users.find((user) => user.id === editingUserId) || null,
    [data, editingUserId],
  );

  const tripById = useMemo(
    () => new Map((data?.trips || []).map((trip) => [trip.id, trip])),
    [data],
  );

  const clearEditor = (payload: SystemUsersPayload | null = data) => {
    setEditingUserId(null);
    setForm({ ...EMPTY_FORM });
    setAssignments(buildAssignmentDraft(payload?.trips || [], null, fallbackRole(payload)));
    setFormMessage('');
  };

  const editUser = (user: SystemUser, payload?: SystemUsersPayload) => {
    const source = payload || data;
    if (!source) return;

    setEditingUserId(user.id);
    setForm({
      displayName: user.displayName || '',
      email: user.email,
      temporaryPassword: '',
      enabled: user.enabled,
    });
    setAssignments(buildAssignmentDraft(source.trips, user, fallbackRole(source)));
    setFormMessage('');
  };

  const applyPayload = (rawPayload: SystemUsersPayload, preferredEditorId: string | null = null) => {
    const payload = normalizePayload(rawPayload);
    setData(payload);
    setStatus('ready');
    setError('');

    if (preferredEditorId) {
      const nextUser = payload.users.find((user) => user.id === preferredEditorId);
      if (nextUser) {
        editUser(nextUser, payload);
        return;
      }
    }

    clearEditor(payload);
  };

  useEffect(() => {
    const screenGeneration = generation.current;
    const request = ++loadSequence.current;
    setStatus('loading');
    setError('');

    void loadSystemUsers()
      .then((payload) => {
        if (generation.current !== screenGeneration || loadSequence.current !== request) return;
        applyPayload(payload);
      })
      .catch(async (loadError: unknown) => {
        if (generation.current !== screenGeneration || loadSequence.current !== request) return;
        if (loadError instanceof SessionExpiredError) {
          await logout();
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los usuarios.');
        setStatus('error');
      });

    return () => {
      generation.current += 1;
    };
  }, [logout]);

  const reload = async (preferredEditorId: string | null = null) => {
    const screenGeneration = generation.current;
    const payload = await loadSystemUsers();
    if (generation.current !== screenGeneration) return null;
    applyPayload(payload, preferredEditorId);
    return payload;
  };

  const handleAsyncError = async (caught: unknown, target: 'page' | 'form' = 'form') => {
    if (caught instanceof SessionExpiredError) {
      await logout();
      return;
    }
    const message = caught instanceof Error ? caught.message : 'No se pudo completar la operación.';
    if (target === 'page') setPageMessage(message);
    else setFormMessage(message);
  };

  const setFormField = <K extends keyof SystemUserFormValues>(field: K, value: SystemUserFormValues[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormMessage('');
  };

  const updateAssignment = (tripId: string, patch: Partial<AssignmentDraft[string]>) => {
    setAssignments((current) => {
      const existing = current[tripId] || {
        selected: false,
        role: fallbackRole(data),
        locked: false,
      };
      return {
        ...current,
        [tripId]: { ...existing, ...patch },
      };
    });
    setFormMessage('');
  };

  const toggleAccess = async (user: SystemUser) => {
    if (busy || user.systemOwner) return;
    const screenGeneration = generation.current;
    setBusy(true);
    setPageMessage(user.enabled ? 'Deshabilitando acceso…' : 'Habilitando acceso…');

    try {
      await toggleSystemUserAccess(user.id, !user.enabled);
      if (generation.current !== screenGeneration) return;
      await reload(editingUserId === user.id ? user.id : editingUserId);
      if (generation.current !== screenGeneration) return;
      setPageMessage(user.enabled ? 'Acceso al sistema deshabilitado.' : 'Acceso al sistema habilitado.');
    } catch (caught) {
      if (generation.current === screenGeneration) await handleAsyncError(caught, 'page');
    } finally {
      if (generation.current === screenGeneration) setBusy(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || busy) return;

    const validation = validateSystemUserForm(form, Boolean(editingUserId));
    if (validation.error || !validation.value) {
      setFormMessage(validation.error || 'Revisá los campos antes de guardar.');
      return;
    }

    const screenGeneration = generation.current;
    const serializedAssignments = assignmentsFromDraft(assignments);
    setBusy(true);
    setFormMessage('Guardando usuario…');
    setPageMessage('');

    try {
      if (editingUserId) {
        await updateSystemUser({
          userId: editingUserId,
          displayName: validation.value.displayName,
          email: validation.value.email,
          enabled: validation.value.enabled,
          assignments: serializedAssignments,
        });
      } else {
        await createSystemUser({
          displayName: validation.value.displayName,
          email: validation.value.email,
          temporaryPassword: validation.value.temporaryPassword,
          assignments: serializedAssignments,
        });
      }

      if (generation.current !== screenGeneration) return;
      await reload();
      if (generation.current !== screenGeneration) return;
      setPageMessage('Usuario guardado.');
    } catch (caught) {
      if (generation.current === screenGeneration) await handleAsyncError(caught, 'form');
    } finally {
      if (generation.current === screenGeneration) setBusy(false);
    }
  };

  if (status === 'loading') {
    return <section className="workspace-card"><div className="inline-status">Cargando usuarios…</div></section>;
  }

  if (status === 'error' || !data) {
    return (
      <section className="workspace-card compact-workspace">
        <div className="eyebrow">Usuarios del sistema</div>
        <h1>No se pudo abrir el gestor de usuarios.</h1>
        <p className="lead">{error || 'Intentá nuevamente.'}</p>
        <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.trips)}>Volver a Mis viajes</button>
      </section>
    );
  }

  const activeCount = data.users.filter((user) => user.enabled).length;
  const pendingPasswordCount = data.users.filter((user) => user.mustChangePassword).length;

  return (
    <section className="workspace-card system-users-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Administración global</div>
          <h1>Usuarios del sistema</h1>
          <p className="lead">Gestioná acceso global, datos personales y asignaciones de viajes.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={() => navigate(appRoutes.trips)}>Volver a Mis viajes</button>
          <button className="primary-button" type="button" disabled={busy} onClick={() => clearEditor()}>+ Agregar usuario</button>
        </div>
      </div>

      <div className="system-user-summary" aria-label="Resumen de usuarios">
        <div className="system-user-summary-card"><strong>{data.users.length}</strong><span>Usuarios</span></div>
        <div className="system-user-summary-card"><strong>{activeCount}</strong><span>Con acceso activo</span></div>
        <div className="system-user-summary-card"><strong>{pendingPasswordCount}</strong><span>Cambio de contraseña pendiente</span></div>
      </div>

      {pageMessage ? <div className="inline-status" aria-live="polite">{pageMessage}</div> : null}

      <div className="system-users-layout">
        <section className="system-users-list-panel" aria-labelledby="system-users-list-title">
          <div className="system-users-section-heading">
            <div>
              <h2 id="system-users-list-title">Usuarios</h2>
              <p>Los cambios de acceso global se aplican independientemente de los roles por viaje.</p>
            </div>
          </div>

          <div className="system-users-list">
            {data.users.map((user) => (
              <article className={`system-user-card ${user.enabled ? '' : 'disabled-user'}`} key={user.id}>
                <div className="system-user-card-top">
                  <div className="system-user-identity">
                    <strong>{userIdentity(user)}</strong>
                    <span>{user.email}</span>
                    <div className="system-user-badges">
                      <span className={`status-chip ${user.enabled ? 'active' : 'inactive'}`}>
                        {user.enabled ? 'Activo' : 'Acceso deshabilitado'}
                      </span>
                      {user.systemOwner ? <span className="status-chip owner">System Owner</span> : null}
                      {user.mustChangePassword ? <span className="status-chip pending">Debe cambiar contraseña</span> : null}
                    </div>
                  </div>
                  <div className="system-user-card-actions">
                    <button className="secondary-button small-button" type="button" disabled={busy} onClick={() => editUser(user)}>Editar</button>
                    {!user.systemOwner ? (
                      <button
                        className={`secondary-button small-button ${user.enabled ? 'danger-button' : ''}`}
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleAccess(user)}
                      >
                        {user.enabled ? 'Deshabilitar' : 'Habilitar'}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="system-user-memberships">
                  {user.memberships.length ? user.memberships.map((membership) => {
                    const trip = tripById.get(membership.tripId);
                    return (
                      <span className="membership-pill" key={`${user.id}-${membership.tripId}`}>
                        {trip?.name || 'Viaje'} · {membership.isOwner ? 'Propietario' : (membership.roleName || membership.role)}
                      </span>
                    );
                  }) : <span className="muted-copy">Sin viajes asignados</span>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="system-user-editor" aria-labelledby="system-user-editor-title">
          <div className="system-users-section-heading">
            <div>
              <h2 id="system-user-editor-title">{editingUser ? 'Editar usuario' : 'Agregar usuario'}</h2>
              <p>{editingUser ? userIdentity(editingUser) : 'Creá una cuenta con contraseña temporal.'}</p>
            </div>
            {editingUser ? <button className="secondary-button small-button" type="button" disabled={busy} onClick={() => clearEditor()}>Limpiar</button> : null}
          </div>

          <form className="system-user-form" onSubmit={handleSubmit} noValidate>
            <fieldset disabled={busy}>
              <label>
                <span>Nombre</span>
                <input
                  value={form.displayName}
                  maxLength={120}
                  required
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFormField('displayName', value);
                  }}
                />
              </label>

              <label>
                <span>Email</span>
                <input
                  value={form.email}
                  type="email"
                  maxLength={254}
                  required
                  autoComplete="off"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFormField('email', value);
                  }}
                />
              </label>

              {!editingUser ? (
                <label>
                  <span>Contraseña temporal</span>
                  <input
                    value={form.temporaryPassword}
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setFormField('temporaryPassword', value);
                    }}
                  />
                  <small>8+ caracteres con mayúscula, minúscula, número y símbolo. El usuario deberá cambiarla al ingresar.</small>
                </label>
              ) : null}

              {editingUser ? (
                <label className="system-user-access-toggle">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    disabled={editingUser.systemOwner || busy}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setFormField('enabled', checked);
                    }}
                  />
                  <span>Acceso al sistema habilitado</span>
                  {editingUser.systemOwner ? <small>El System Owner no puede ser deshabilitado.</small> : null}
                </label>
              ) : null}

              <div className="system-user-assignment-heading">
                <h3>Viajes y roles</h3>
                <p>Los viajes donde el usuario es propietario quedan bloqueados para preservar esa relación.</p>
              </div>

              <div className="system-user-assignments">
                {data.trips.length ? data.trips.map((trip) => {
                  const entry = assignments[trip.id] || { selected: false, role: fallbackRole(data), locked: false };
                  return (
                    <div className="system-user-assignment-row" key={trip.id}>
                      <label className="assignment-check-label">
                        <input
                          type="checkbox"
                          checked={entry.selected}
                          disabled={entry.locked || busy}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            updateAssignment(trip.id, { selected: checked });
                          }}
                        />
                        <span>
                          <strong>{trip.name}</strong>
                          <small>{trip.destination || 'Sin destino informado'}{entry.locked ? ' · Propietario' : ''}</small>
                        </span>
                      </label>
                      <select
                        aria-label={`Rol en ${trip.name}`}
                        value={entry.role}
                        disabled={!entry.selected || entry.locked || busy}
                        onChange={(event) => {
                          const role = event.currentTarget.value;
                          updateAssignment(trip.id, { role });
                        }}
                      >
                        {data.roles.map((role) => <option value={role.code} key={role.code}>{role.name}</option>)}
                      </select>
                    </div>
                  );
                }) : <div className="empty-state"><span>No hay viajes disponibles para asignar.</span></div>}
              </div>
            </fieldset>

            {formMessage ? <div className="inline-status error" aria-live="polite">{formMessage}</div> : null}
            <button className="primary-button system-user-save" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar usuario'}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
