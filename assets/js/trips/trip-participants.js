import { tripApi } from '../api.js';
import { $, setStatus } from '../shared/dom.js';

let activeTrip = null;
let roles = [];
let callbacks = {};
let generation = 0;
let busy = false;
let availableCount = 0;

function ensureUi() {
  if ($('tripParticipantsGate')) return;

  const gate = document.createElement('div');
  gate.id = 'tripParticipantsGate';
  gate.className = 'trip-gate';
  gate.setAttribute('aria-hidden', 'true');
  gate.innerHTML = `
    <section class="glass-panel trip-participants-panel p-4 p-md-5">
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-4">
        <div>
          <div class="fs-2">👥</div>
          <h1 id="tripParticipantsHeading" class="h3 fw-bold mb-1" tabindex="-1">Participantes</h1>
          <p id="tripParticipantsTripName" class="trip-muted mb-0"></p>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button id="tripParticipantsBack" type="button" class="btn btn-outline-light btn-sm">Volver al viaje</button>
          <button id="tripParticipantsLogout" type="button" class="btn btn-outline-light btn-sm">Cerrar sesión</button>
        </div>
      </div>

      <div class="row g-3 mb-4" aria-label="Resumen de participantes">
        <div class="col-6 col-md-4">
          <div class="participant-summary-card p-3">
            <div id="tripParticipantsCount" class="participant-summary-value">0</div>
            <div class="small trip-muted">Participantes</div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="participant-summary-card p-3">
            <div id="tripParticipantsActiveCount" class="participant-summary-value">0</div>
            <div class="small trip-muted">Con acceso activo</div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="participant-summary-card p-3">
            <div id="tripParticipantsAvailableCount" class="participant-summary-value">0</div>
            <div class="small trip-muted">Disponibles para agregar</div>
          </div>
        </div>
      </div>

      <div id="tripParticipantsStatus" class="small mb-3 trip-muted" aria-live="polite"></div>

      <div class="row g-4">
        <div class="col-lg-7">
          <section class="participant-section h-100 p-3 p-md-4" aria-labelledby="currentParticipantsTitle">
            <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
              <div>
                <h2 id="currentParticipantsTitle" class="h5 fw-bold mb-1">Participantes actuales</h2>
                <p class="small trip-muted mb-0">Cambiá el rol o quitá participantes del viaje.</p>
              </div>
            </div>
            <div id="tripParticipantsMembers" class="d-grid gap-2"></div>
          </section>
        </div>

        <div class="col-lg-5">
          <section class="participant-section p-3 p-md-4" aria-labelledby="addParticipantsTitle">
            <h2 id="addParticipantsTitle" class="h5 fw-bold mb-1">Agregar participantes</h2>
            <p class="small trip-muted">Solo aparecen usuarios existentes con acceso global activo y que todavía no pertenecen al viaje.</p>
            <form id="tripParticipantsForm" autocomplete="off">
              <div class="form-label">Usuarios disponibles</div>
              <div id="tripParticipantsAvailable" class="available-users participant-available-list mb-3"></div>

              <label for="tripParticipantsRole" class="form-label">Rol para seleccionados</label>
              <select id="tripParticipantsRole" class="form-select" required disabled></select>

              <button id="tripParticipantsAdd" class="btn btn-trip w-100 mt-3" type="submit" disabled>Agregar seleccionados</button>
            </form>
          </section>
        </div>
      </div>
    </section>`;

  document.body.insertBefore(gate, $('tripShell'));
}

function activeRef() {
  return activeTrip ? { slug: activeTrip.slug } : {};
}

function setBusy(value) {
  busy = value;
  for (const control of $('tripParticipantsGate').querySelectorAll('button, select, input')) {
    if (control.id === 'tripParticipantsLogout') continue;
    control.disabled = value;
  }
  if (!value && availableCount === 0) {
    $('tripParticipantsRole').disabled = true;
    $('tripParticipantsAdd').disabled = true;
  }
}

function populateRoleSelect() {
  const select = $('tripParticipantsRole');
  select.replaceChildren();
  for (const role of roles) {
    const option = document.createElement('option');
    option.value = role.code;
    option.textContent = role.name;
    select.append(option);
  }
  const viewer = roles.find((role) => role.code === 'viewer');
  if (viewer) select.value = viewer.code;
}

function renderSummary(members, availableUsers) {
  $('tripParticipantsCount').textContent = String(members.length);
  $('tripParticipantsActiveCount').textContent = String(members.filter((member) => member.profile?.enabled !== false).length);
  $('tripParticipantsAvailableCount').textContent = String(availableUsers.length);
}

function memberIdentity(member) {
  return member.profile?.displayName?.trim() || member.profile?.email || 'Usuario';
}

function renderMembers(members) {
  const container = $('tripParticipantsMembers');
  container.replaceChildren();

  if (!members.length) {
    const empty = document.createElement('div');
    empty.className = 'participant-empty p-3 small trip-muted';
    empty.textContent = 'Todavía no hay participantes en este viaje.';
    container.append(empty);
    return;
  }

  for (const member of members) {
    const row = document.createElement('article');
    row.className = 'member-row participant-member-row p-3';

    const top = document.createElement('div');
    top.className = 'd-flex flex-column flex-md-row align-items-md-center gap-3';

    const info = document.createElement('div');
    info.className = 'me-auto min-w-0';
    const name = document.createElement('strong');
    name.className = 'd-block text-break';
    name.textContent = memberIdentity(member);
    const detail = document.createElement('div');
    detail.className = 'small trip-muted text-break';
    detail.textContent = member.profile?.email || '';
    info.append(name, detail);

    const badges = document.createElement('div');
    badges.className = 'd-flex flex-wrap gap-2';
    if (member.isOwner) {
      const owner = document.createElement('span');
      owner.className = 'badge role-badge';
      owner.textContent = 'Propietario';
      badges.append(owner);
    }
    if (member.profile?.enabled === false) {
      const disabled = document.createElement('span');
      disabled.className = 'badge text-bg-secondary';
      disabled.textContent = 'Acceso global deshabilitado';
      badges.append(disabled);
    }

    top.append(info, badges);
    row.append(top);

    if (!member.isOwner) {
      const actions = document.createElement('div');
      actions.className = 'participant-member-actions d-flex flex-column flex-sm-row gap-2 mt-3';

      const roleGroup = document.createElement('div');
      roleGroup.className = 'flex-grow-1';
      const label = document.createElement('label');
      const selectId = `participant-role-${member.userId}`;
      label.htmlFor = selectId;
      label.className = 'visually-hidden';
      label.textContent = `Rol de ${memberIdentity(member)}`;
      const roleSelect = document.createElement('select');
      roleSelect.id = selectId;
      roleSelect.className = 'form-select form-select-sm';
      roleSelect.setAttribute('aria-label', `Rol de ${memberIdentity(member)}`);
      for (const role of roles) {
        const option = document.createElement('option');
        option.value = role.code;
        option.textContent = role.name;
        option.selected = role.id === member.roleId;
        roleSelect.append(option);
      }
      const previousRole = roleSelect.value;
      roleSelect.addEventListener('change', async () => {
        const nextRole = roleSelect.value;
        roleSelect.disabled = true;
        setStatus($('tripParticipantsStatus'), 'Actualizando rol…');
        try {
          await tripApi('update-role', { ...activeRef(), userId: member.userId, role: nextRole });
          setStatus($('tripParticipantsStatus'), 'Rol actualizado.', 'ok');
          const refreshed = await loadTripParticipants();
          if (!refreshed && document.contains(roleSelect)) roleSelect.disabled = false;
        } catch (error) {
          roleSelect.value = previousRole;
          roleSelect.disabled = false;
          if (error.message !== 'SESSION_EXPIRED') {
            setStatus($('tripParticipantsStatus'), error.message || 'No se pudo actualizar el rol.', 'error');
          }
        }
      });
      roleGroup.append(label, roleSelect);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-outline-danger btn-sm';
      remove.textContent = 'Quitar del viaje';
      remove.addEventListener('click', async () => {
        if (!window.confirm(`¿Quitar a ${memberIdentity(member)} de este viaje?`)) return;
        remove.disabled = true;
        setStatus($('tripParticipantsStatus'), 'Quitando participante…');
        try {
          await tripApi('remove', { ...activeRef(), userId: member.userId });
          setStatus($('tripParticipantsStatus'), 'Participante quitado del viaje.', 'ok');
          const refreshed = await loadTripParticipants();
          if (!refreshed && document.contains(remove)) remove.disabled = false;
        } catch (error) {
          remove.disabled = false;
          if (error.message !== 'SESSION_EXPIRED') {
            setStatus($('tripParticipantsStatus'), error.message || 'No se pudo quitar al participante.', 'error');
          }
        }
      });

      actions.append(roleGroup, remove);
      row.append(actions);
    }

    container.append(row);
  }
}

function renderAvailableUsers(users) {
  const container = $('tripParticipantsAvailable');
  container.replaceChildren();
  availableCount = users.length;

  if (!users.length) {
    const empty = document.createElement('div');
    empty.className = 'participant-empty p-3 small trip-muted';
    empty.textContent = 'No hay usuarios activos disponibles para agregar.';
    container.append(empty);
    $('tripParticipantsRole').disabled = true;
    $('tripParticipantsAdd').disabled = true;
    return;
  }

  for (const user of users) {
    const row = document.createElement('div');
    row.className = 'available-user-row participant-available-user';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input mt-0';
    checkbox.value = user.id;
    checkbox.id = `participant-available-${user.id}`;

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.className = 'min-w-0';
    const name = document.createElement('strong');
    name.className = 'd-block text-break';
    name.textContent = user.displayName || user.email;
    const email = document.createElement('div');
    email.className = 'small trip-muted text-break';
    email.textContent = user.email;
    label.append(name, email);

    row.append(checkbox, label);
    container.append(row);
  }

  $('tripParticipantsRole').disabled = false;
  $('tripParticipantsAdd').disabled = false;
}

export async function loadTripParticipants() {
  if (!activeTrip) return false;
  const requestGeneration = generation;
  setStatus($('tripParticipantsStatus'), 'Cargando participantes…');
  try {
    const result = await tripApi('trip-admin', activeRef());
    if (requestGeneration !== generation || !activeTrip) return false;
    roles = result.roles || [];
    const members = result.members || [];
    const availableUsers = result.availableUsers || [];
    populateRoleSelect();
    renderMembers(members);
    renderAvailableUsers(availableUsers);
    renderSummary(members, availableUsers);
    setStatus($('tripParticipantsStatus'));
    return true;
  } catch (error) {
    if (requestGeneration === generation && error.message !== 'SESSION_EXPIRED') {
      setStatus($('tripParticipantsStatus'), error.message || 'No se pudieron cargar los participantes.', 'error');
    }
    return false;
  }
}

export function showTripParticipants(trip) {
  ensureUi();
  hideTripParticipants();
  activeTrip = trip;
  $('tripParticipantsTripName').textContent = trip.name;
  $('tripParticipantsGate').classList.add('visible');
  $('tripParticipantsGate').setAttribute('aria-hidden', 'false');
  $('tripParticipantsHeading').focus();
  loadTripParticipants();
}

export function hideTripParticipants() {
  generation += 1;
  activeTrip = null;
  roles = [];
  busy = false;
  availableCount = 0;
  const gate = $('tripParticipantsGate');
  if (!gate) return;
  gate.classList.remove('visible');
  gate.setAttribute('aria-hidden', 'true');
  $('tripParticipantsForm').reset();
  $('tripParticipantsMembers').replaceChildren();
  $('tripParticipantsAvailable').replaceChildren();
  $('tripParticipantsRole').replaceChildren();
  $('tripParticipantsRole').disabled = true;
  $('tripParticipantsAdd').disabled = true;
  $('tripParticipantsTripName').textContent = '';
  $('tripParticipantsCount').textContent = '0';
  $('tripParticipantsActiveCount').textContent = '0';
  $('tripParticipantsAvailableCount').textContent = '0';
  setStatus($('tripParticipantsStatus'));
}

export function bindTripParticipants(handlers = {}) {
  ensureUi();
  callbacks = handlers;

  $('tripParticipantsBack').addEventListener('click', () => activeTrip && callbacks.onBack?.(activeTrip));
  $('tripParticipantsLogout').addEventListener('click', () => callbacks.onLogout?.());

  $('tripParticipantsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeTrip || busy) return;

    const selected = [...$('tripParticipantsAvailable').querySelectorAll('input[type="checkbox"]:checked')]
      .map((input) => input.value);
    if (!selected.length) {
      setStatus($('tripParticipantsStatus'), 'Seleccioná al menos un usuario.', 'error');
      return;
    }

    const role = $('tripParticipantsRole').value;
    if (!role) {
      setStatus($('tripParticipantsStatus'), 'Seleccioná un rol.', 'error');
      return;
    }

    const requestGeneration = generation;
    setBusy(true);
    setStatus($('tripParticipantsStatus'), selected.length === 1 ? 'Agregando participante…' : 'Agregando participantes…');
    try {
      await Promise.all(selected.map((userId) => tripApi('assign', { ...activeRef(), userId, role })));
      if (requestGeneration !== generation) return;
      setStatus($('tripParticipantsStatus'), selected.length === 1 ? 'Participante agregado.' : 'Participantes agregados.', 'ok');
      await loadTripParticipants();
    } catch (error) {
      if (requestGeneration === generation && error.message !== 'SESSION_EXPIRED') {
        setStatus($('tripParticipantsStatus'), error.message || 'No se pudieron agregar los participantes.', 'error');
      }
    } finally {
      if (requestGeneration === generation) setBusy(false);
    }
  });
}
