import { systemUserApi } from '../api.js';
import { STRONG_PASSWORD_RE } from '../shared/constants.js';
import { $, setStatus } from '../shared/dom.js';
import { state } from '../state.js';

function tripName(tripId) {
  return state.systemData.trips?.find((trip) => trip.id === tripId)?.name || 'Viaje';
}

function renderSystemUsers() {
  const container = $('systemUserList');
  container.replaceChildren();

  for (const user of state.systemData.users || []) {
    const card = document.createElement('div');
    card.className = `user-card p-3 ${user.enabled ? '' : 'disabled-user'}`;

    const top = document.createElement('div');
    top.className = 'd-flex gap-2 align-items-start';
    const info = document.createElement('div');
    info.className = 'me-auto';
    const name = document.createElement('strong');
    name.textContent = user.displayName || user.email;
    const email = document.createElement('div');
    email.className = 'small trip-muted';
    email.textContent = user.email;
    const status = document.createElement('div');
    status.className = `user-status mt-1 ${user.enabled ? 'text-success' : 'text-warning'}`;
    status.textContent = user.systemOwner ? 'PROPIETARIO DEL SISTEMA' : user.enabled ? 'ACTIVO' : 'ACCESO DESHABILITADO';
    info.append(name, email, status);
    top.append(info);

    const edit = document.createElement('button');
    edit.className = 'btn btn-outline-light btn-sm';
    edit.type = 'button';
    edit.textContent = 'Editar';
    edit.addEventListener('click', () => editSystemUser(user.id));
    top.append(edit);

    if (!user.systemOwner) {
      const toggle = document.createElement('button');
      toggle.className = user.enabled ? 'btn btn-outline-danger btn-sm' : 'btn btn-outline-success btn-sm';
      toggle.type = 'button';
      toggle.textContent = user.enabled ? 'Deshabilitar' : 'Habilitar';
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        try {
          await systemUserApi('toggle-access', { userId: user.id, enabled: !user.enabled });
          state.systemData = await systemUserApi('list');
          renderSystemUsers();
          if (state.editingUserId === user.id) editSystemUser(user.id);
          setStatus($('userManagerStatus'), user.enabled ? 'Acceso al sistema deshabilitado.' : 'Acceso al sistema habilitado.', 'ok');
        } catch (error) {
          setStatus($('userManagerStatus'), error.message, 'error');
          toggle.disabled = false;
        }
      });
      top.append(toggle);
    }

    const assignments = document.createElement('div');
    assignments.className = 'small trip-muted mt-2';
    assignments.textContent = user.memberships?.length
      ? user.memberships.map((membership) => `${tripName(membership.tripId)} · ${membership.isOwner ? 'Propietario' : membership.roleName}`).join(' | ')
      : 'Sin viajes asignados';

    card.append(top, assignments);
    container.append(card);
  }
}

function roleOptions(select, selected = 'viewer') {
  select.replaceChildren();
  for (const role of state.systemData.roles || []) {
    const option = document.createElement('option');
    option.value = role.code;
    option.textContent = role.name;
    option.selected = role.code === selected;
    select.append(option);
  }
}

function renderAssignmentEditor(user = null) {
  const container = $('systemUserAssignments');
  container.replaceChildren();

  for (const trip of state.systemData.trips || []) {
    const existing = user?.memberships?.find((membership) => membership.tripId === trip.id);
    const row = document.createElement('div');
    row.className = 'assignment-row';

    const checkWrap = document.createElement('div');
    checkWrap.className = 'form-check';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'form-check-input assignment-check';
    check.dataset.tripId = trip.id;
    check.id = `assignment-${trip.id}`;
    check.checked = !!existing;
    if (existing?.isOwner) check.disabled = true;

    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = check.id;
    label.textContent = `${trip.name} · ${trip.destination || ''}`;
    checkWrap.append(check, label);

    const select = document.createElement('select');
    select.className = 'form-select form-select-sm assignment-role';
    select.dataset.tripId = trip.id;
    roleOptions(select, existing?.role || 'viewer');
    select.disabled = !check.checked || existing?.isOwner;
    check.addEventListener('change', () => { select.disabled = !check.checked; });

    row.append(checkWrap, select);
    container.append(row);
  }
}

export function clearUserEditor() {
  state.editingUserId = null;
  $('systemUserForm').reset();
  $('systemUserFormTitle').textContent = 'Agregar usuario';
  $('systemUserPasswordGroup').classList.remove('d-none');
  $('systemUserPassword').required = true;
  $('systemUserEnabled').checked = true;
  $('systemUserEnabled').disabled = false;
  renderAssignmentEditor();
  setStatus($('systemUserFormStatus'));
}

function editSystemUser(userId) {
  const user = state.systemData.users.find((item) => item.id === userId);
  if (!user) return;

  state.editingUserId = userId;
  $('systemUserFormTitle').textContent = 'Editar usuario';
  $('systemUserName').value = user.displayName || '';
  $('systemUserEmail').value = user.email;
  $('systemUserPasswordGroup').classList.add('d-none');
  $('systemUserPassword').required = false;
  $('systemUserPassword').value = '';
  $('systemUserEnabled').checked = user.enabled;
  $('systemUserEnabled').disabled = user.systemOwner;
  renderAssignmentEditor(user);
  setStatus($('systemUserFormStatus'));
}

function collectAssignments() {
  const assignments = [];
  for (const check of document.querySelectorAll('.assignment-check')) {
    if (!check.checked) continue;
    const role = document.querySelector(`.assignment-role[data-trip-id="${check.dataset.tripId}"]`);
    assignments.push({ tripId: check.dataset.tripId, role: role?.value || 'viewer' });
  }
  return assignments;
}

export async function openUserManager() {
  setStatus($('userManagerStatus'), 'Cargando usuarios…');
  state.userManagerModal.show();
  try {
    state.systemData = await systemUserApi('list');
    renderSystemUsers();
    clearUserEditor();
    setStatus($('userManagerStatus'));
  } catch (error) {
    setStatus($('userManagerStatus'), error.message, 'error');
  }
}

export function bindUserManager() {
  $('manageUsersButton').addEventListener('click', openUserManager);
  $('newSystemUserButton').addEventListener('click', clearUserEditor);
  $('cancelSystemUserEdit').addEventListener('click', clearUserEditor);

  $('systemUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayNameValue = $('systemUserName').value.trim();
    const emailValue = $('systemUserEmail').value.trim().toLowerCase();
    const assignments = collectAssignments();
    setStatus($('systemUserFormStatus'), 'Guardando…');

    try {
      if (state.editingUserId) {
        await systemUserApi('update', {
          userId: state.editingUserId,
          displayName: displayNameValue,
          email: emailValue,
          enabled: $('systemUserEnabled').checked,
          assignments,
        });
      } else {
        const temporaryPassword = $('systemUserPassword').value;
        if (!STRONG_PASSWORD_RE.test(temporaryPassword)) {
          throw new Error('La contraseña temporal debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo.');
        }
        await systemUserApi('create', {
          displayName: displayNameValue,
          email: emailValue,
          temporaryPassword,
          assignments,
        });
      }

      state.systemData = await systemUserApi('list');
      renderSystemUsers();
      clearUserEditor();
      setStatus($('userManagerStatus'), 'Usuario guardado.', 'ok');
    } catch (error) {
      setStatus($('systemUserFormStatus'), error.message, 'error');
    }
  });
}
