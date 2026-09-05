import { tripApi } from '../api.js';
import { $, setStatus } from '../shared/dom.js';
import { state } from '../state.js';

function currentTripRef() {
  return { slug: state.currentTrip?.slug };
}

function populateTripRoleSelect() {
  const select = $('tripMemberRole');
  select.replaceChildren();
  for (const role of state.roles) {
    const option = document.createElement('option');
    option.value = role.code;
    option.textContent = role.name;
    select.append(option);
  }
  const viewer = state.roles.find((role) => role.code === 'viewer');
  if (viewer) select.value = viewer.code;
}

function renderTripMembers(members) {
  $('members').replaceChildren(...members.map((member) => {
    const row = document.createElement('div');
    row.className = 'member-row p-3 d-flex flex-column flex-md-row gap-2 align-items-md-center';

    const info = document.createElement('div');
    info.className = 'me-auto';
    const strong = document.createElement('strong');
    strong.textContent = member.profile?.displayName || member.profile?.email || 'Usuario';
    const detail = document.createElement('div');
    detail.className = 'small trip-muted';
    detail.textContent = `${member.profile?.email || ''}${member.profile?.enabled === false ? ' · Acceso global deshabilitado' : ''}`;
    info.append(strong, detail);
    row.append(info);

    if (member.isOwner) {
      const badge = document.createElement('span');
      badge.className = 'badge role-badge';
      badge.textContent = 'Propietario';
      row.append(badge);
      return row;
    }

    const roleSelect = document.createElement('select');
    roleSelect.className = 'form-select form-select-sm w-auto';
    for (const role of state.roles) {
      const option = document.createElement('option');
      option.value = role.code;
      option.textContent = role.name;
      option.selected = role.id === member.roleId;
      roleSelect.append(option);
    }
    roleSelect.addEventListener('change', async () => {
      roleSelect.disabled = true;
      try {
        await tripApi('update-role', { ...currentTripRef(), userId: member.userId, role: roleSelect.value });
        setStatus($('tripMemberStatus'), 'Rol actualizado.', 'ok');
        await loadTripAdminData();
      } catch (error) {
        setStatus($('tripMemberStatus'), error.message, 'error');
        roleSelect.disabled = false;
      }
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-outline-danger btn-sm';
    remove.textContent = 'Quitar del viaje';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await tripApi('remove', { ...currentTripRef(), userId: member.userId });
        setStatus($('tripMemberStatus'), 'Usuario quitado del viaje.', 'ok');
        await loadTripAdminData();
      } catch (error) {
        remove.disabled = false;
        setStatus($('tripMemberStatus'), error.message, 'error');
      }
    });

    row.append(roleSelect, remove);
    return row;
  }));
}

function renderAvailableUsers(users) {
  const container = $('availableUsersList');
  container.replaceChildren();

  if (!users.length) {
    const empty = document.createElement('div');
    empty.className = 'p-3 small trip-muted';
    empty.textContent = 'No hay otros usuarios activos disponibles.';
    container.append(empty);
    return;
  }

  for (const user of users) {
    const row = document.createElement('div');
    row.className = 'available-user-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input mt-0';
    checkbox.value = user.id;
    checkbox.id = `available-${user.id}`;

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    const name = document.createElement('strong');
    name.textContent = user.displayName || user.email;
    const email = document.createElement('div');
    email.className = 'small trip-muted';
    email.textContent = user.email;
    label.append(name, email);

    row.append(checkbox, label);
    container.append(row);
  }
}

export async function loadTripAdminData() {
  try {
    const result = await tripApi('trip-admin', currentTripRef());
    state.roles = result.roles || [];
    populateTripRoleSelect();
    renderTripMembers(result.members || []);
    renderAvailableUsers(result.availableUsers || []);
  } catch (error) {
    setStatus($('tripMemberStatus'), error.message || 'No se pudo cargar la administración.', 'error');
  }
}

export function bindTripAdminForm() {
  $('tripMemberForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const selected = [...$('availableUsersList').querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    if (!selected.length) return setStatus($('tripMemberStatus'), 'Seleccioná al menos un usuario.', 'error');

    setStatus($('tripMemberStatus'), 'Agregando usuarios…');
    try {
      await Promise.all(selected.map((userId) => tripApi('assign', {
        ...currentTripRef(),
        userId,
        role: $('tripMemberRole').value,
      })));
      setStatus($('tripMemberStatus'), 'Usuarios agregados al viaje.', 'ok');
      await loadTripAdminData();
    } catch (error) {
      setStatus($('tripMemberStatus'), error.message, 'error');
    }
  });
}
