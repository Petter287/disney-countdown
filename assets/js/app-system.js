import { supabase, tripApi, systemUserApi } from './api.js';

const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let tripMemberships = [];
let currentTrip = null;
let currentMembership = null;
let roles = [];
let countdownTimer = null;
let privateModal = null;
let userManagerModal = null;
let systemData = { users: [], trips: [], roles: [] };
let editingUserId = null;

function setStatus(element, message = '', type = '') {
  if (!element) return;
  element.textContent = message;
  element.className = `small mt-2 ${type === 'error' ? 'text-danger' : type === 'ok' ? 'text-success' : 'trip-muted'}`;
}

function clearTripUi() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  currentTrip = null;
  currentMembership = null;
  $('tripShell').replaceChildren();
  $('tripShell').classList.remove('visible');
  $('tripShell').setAttribute('aria-hidden', 'true');
  $('tripShell').style.removeProperty('--trip-background-image');
  $('adminPanel').classList.remove('visible');
  $('members').replaceChildren();
  $('availableUsersList').replaceChildren();
  setStatus($('tripMemberStatus'));
}

function showLogin(message = '', type = '') {
  clearTripUi();
  $('tripGate').classList.remove('visible');
  $('tripGate').setAttribute('aria-hidden', 'true');
  $('authGate').classList.remove('hidden');
  $('loginFields').classList.remove('d-none');
  $('changePasswordForm').classList.remove('visible');
  setStatus($('authStatus'), message, type);
}

function showTripPicker() {
  clearTripUi();
  $('authGate').classList.add('hidden');
  $('tripGate').classList.add('visible');
  $('tripGate').setAttribute('aria-hidden', 'false');
}

function displayName(profile) {
  return profile?.displayName?.trim() || profile?.email?.split('@')[0] || 'viajero';
}

function renderTripPicker() {
  $('tripGreeting').textContent = `Hola, ${displayName(currentProfile)} 👋`;
  $('systemOwnerActions').classList.toggle('visible', currentProfile?.systemOwner === true);
  $('tripList').replaceChildren();

  for (const membership of tripMemberships) {
    const trip = membership.trip;
    if (!trip) continue;

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'trip-card w-100 text-start p-4';

    const top = document.createElement('div');
    top.className = 'd-flex align-items-center justify-content-between gap-3 mb-2';
    const name = document.createElement('strong');
    name.className = 'fs-5';
    name.textContent = `✈️ ${trip.name}`;
    const badge = document.createElement('span');
    badge.className = 'badge role-badge';
    badge.textContent = membership.role?.name || 'Sin rol';
    top.append(name, badge);

    const destination = document.createElement('div');
    destination.className = 'trip-muted';
    destination.textContent = trip.destination || '';
    const hint = document.createElement('div');
    hint.className = 'small mt-3';
    hint.textContent = 'Abrir viaje →';

    button.append(top, destination, hint);
    button.addEventListener('click', () => openTrip(membership));
    col.append(button);
    $('tripList').append(col);
  }

  setStatus(
    $('tripGateStatus'),
    tripMemberships.length ? '' : 'No tenés viajes asignados.',
    tripMemberships.length ? '' : 'error',
  );
}

async function authorize(user) {
  currentUser = user;
  try {
    const bootstrap = await tripApi('bootstrap');
    currentProfile = bootstrap.profile;
    tripMemberships = bootstrap.memberships || [];
  } catch (error) {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    tripMemberships = [];
    showLogin(error.message || 'No se pudo validar tu acceso.', 'error');
    return;
  }

  if (currentProfile.mustChangePassword) {
    clearTripUi();
    $('tripGate').classList.remove('visible');
    $('loginFields').classList.add('d-none');
    $('changePasswordForm').classList.add('visible');
    $('authGate').classList.remove('hidden');
    setStatus($('authStatus'), 'Por seguridad, cambiá la contraseña temporal antes de continuar.');
    return;
  }

  renderTripPicker();
  showTripPicker();
}

function renderTripShell(settings) {
  const shell = $('tripShell');
  shell.innerHTML = `
    <button id="openTripDetails" class="btn btn-dark position-fixed top-0 end-0 m-3 rounded-pill z-3" type="button">✨ Mi viaje</button>
    <button id="quickChangeTrip" class="btn btn-dark position-fixed top-0 start-0 m-3 rounded-pill z-3" type="button">🌎 Mis viajes</button>
    <main class="container min-vh-100 d-flex align-items-center justify-content-center py-3">
      <section class="countdown-card w-100 p-4 text-center">
        <div id="tripEyebrow" class="eyebrow mb-2"></div>
        <h1 id="tripTitle" class="trip-title fw-bold mb-2"></h1>
        <p id="tripSubtitle" class="trip-muted mb-3"></p>
        <span id="datePill" class="badge rounded-pill date-pill px-3 py-2"></span>
        <div class="row g-2 my-3">
          <div class="col-6 col-md-3"><div class="count-unit d-flex flex-column justify-content-center"><div id="days" class="count-number">000</div><div class="count-label">Días</div></div></div>
          <div class="col-6 col-md-3"><div class="count-unit d-flex flex-column justify-content-center"><div id="hours" class="count-number">00</div><div class="count-label">Horas</div></div></div>
          <div class="col-6 col-md-3"><div class="count-unit d-flex flex-column justify-content-center"><div id="minutes" class="count-number">00</div><div class="count-label">Minutos</div></div></div>
          <div class="col-6 col-md-3"><div class="count-unit d-flex flex-column justify-content-center"><div id="seconds" class="count-number">00</div><div class="count-label">Segundos</div></div></div>
        </div>
        <div class="d-flex justify-content-between small trip-muted mb-2"><span>Cuenta regresiva iniciada</span><span id="progressText">Calculando…</span></div>
        <div class="progress rounded-pill"><div id="progressBar" class="progress-bar"></div></div>
        <p id="targetInfo" class="small trip-muted mt-3 mb-1">Calculando fecha…</p>
        <p id="photoCredit" class="photo-credit mb-0"></p>
      </section>
    </main>`;

  $('tripEyebrow').textContent = settings.eyebrow;
  $('tripTitle').textContent = settings.title;
  $('tripSubtitle').textContent = settings.subtitle;
  $('photoCredit').textContent = settings.photoCredit || '';

  if (settings.backgroundUrl) {
    try {
      const url = new URL(settings.backgroundUrl);
      if (url.protocol === 'https:') shell.style.setProperty('--trip-background-image', `url("${url.href}")`);
    } catch {
      // Keep the CSS fallback image.
    }
  }

  $('openTripDetails').addEventListener('click', () => privateModal.show());
  $('quickChangeTrip').addEventListener('click', changeTrip);
  shell.setAttribute('aria-hidden', 'false');
}

async function openTrip(membership) {
  const trip = membership.trip;
  if (!trip) return;

  setStatus($('tripGateStatus'), 'Cargando viaje…');
  let settings;
  try {
    const result = await tripApi('trip-detail', { tripId: trip.id });
    settings = result.settings;
  } catch (error) {
    setStatus($('tripGateStatus'), error.message || 'No se pudo cargar la configuración del viaje.', 'error');
    return;
  }

  currentTrip = trip;
  currentMembership = membership;
  $('authGate').classList.add('hidden');
  $('tripGate').classList.remove('visible');
  renderTripShell(settings);
  $('tripShell').classList.add('visible');
  $('privateTripTitle').textContent = `✨ ${trip.name}`;
  $('userLine').textContent = `${currentProfile.email} · ${membership.role?.name || 'Sin rol'}`;

  const canManage = currentProfile.systemOwner || membership.role?.code === 'admin';
  $('adminPanel').classList.toggle('visible', canManage);
  if (canManage) await loadTripAdminData();
  startCountdown(settings);
}

function populateTripRoleSelect() {
  const select = $('tripMemberRole');
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
    for (const role of roles) {
      const option = document.createElement('option');
      option.value = role.code;
      option.textContent = role.name;
      option.selected = role.id === member.roleId;
      roleSelect.append(option);
    }
    roleSelect.addEventListener('change', async () => {
      roleSelect.disabled = true;
      try {
        await tripApi('update-role', { tripId: currentTrip.id, userId: member.userId, role: roleSelect.value });
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
        await tripApi('remove', { tripId: currentTrip.id, userId: member.userId });
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

async function loadTripAdminData() {
  try {
    const result = await tripApi('trip-admin', { tripId: currentTrip.id });
    roles = result.roles || [];
    populateTripRoleSelect();
    renderTripMembers(result.members || []);
    renderAvailableUsers(result.availableUsers || []);
  } catch (error) {
    setStatus($('tripMemberStatus'), error.message || 'No se pudo cargar la administración.', 'error');
  }
}

function changeTrip() {
  if (privateModal) privateModal.hide();
  renderTripPicker();
  showTripPicker();
}

async function logout() {
  if (privateModal) privateModal.hide();
  if (userManagerModal) userManagerModal.hide();
  clearTripUi();
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  tripMemberships = [];
  $('loginForm').reset();
  $('changePasswordForm').reset();
  showLogin();
}

async function openUserManager() {
  setStatus($('userManagerStatus'), 'Cargando usuarios…');
  userManagerModal.show();
  try {
    systemData = await systemUserApi('list');
    renderSystemUsers();
    clearUserEditor();
    setStatus($('userManagerStatus'));
  } catch (error) {
    setStatus($('userManagerStatus'), error.message, 'error');
  }
}

function tripName(tripId) {
  return systemData.trips?.find((trip) => trip.id === tripId)?.name || 'Viaje';
}

function renderSystemUsers() {
  const container = $('systemUserList');
  container.replaceChildren();

  for (const user of systemData.users || []) {
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
          systemData = await systemUserApi('list');
          renderSystemUsers();
          if (editingUserId === user.id) editSystemUser(user.id);
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
  for (const role of systemData.roles || []) {
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

  for (const trip of systemData.trips || []) {
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

function clearUserEditor() {
  editingUserId = null;
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
  const user = systemData.users.find((item) => item.id === userId);
  if (!user) return;

  editingUserId = userId;
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

function startCountdown(settings) {
  const start = new Date(settings.startAt);
  const spainZones = new Set(['Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta']);

  const apply = (target, label, info) => {
    clearInterval(countdownTimer);
    $('datePill').textContent = label;
    $('targetInfo').textContent = info;

    const tick = () => {
      const now = new Date();
      const diff = Math.max(0, target - now);
      $('days').textContent = String(Math.floor(diff / 864e5)).padStart(3, '0');
      $('hours').textContent = String(Math.floor(diff / 36e5) % 24).padStart(2, '0');
      $('minutes').textContent = String(Math.floor(diff / 6e4) % 60).padStart(2, '0');
      $('seconds').textContent = String(Math.floor(diff / 1e3) % 60).padStart(2, '0');
      const denominator = target - start;
      const percent = denominator > 0 ? Math.min(100, Math.max(0, ((now - start) / denominator) * 100)) : 100;
      $('progressBar').style.width = `${percent}%`;
      $('progressText').textContent = `${percent.toFixed(1)}%`;
    };

    tick();
    countdownTimer = setInterval(tick, 1000);
  };

  const useDefault = () => {
    const target = new Date(settings.defaultArrivalAt);
    apply(target, formatArrivalDate(target, settings.defaultTimezone || 'UTC'), 'Fecha de llegada según el viaje seleccionado.');
  };

  const fallback = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (settings.spainArrivalAt && spainZones.has(tz)) {
      const canary = tz === 'Atlantic/Canary';
      const target = new Date(canary && settings.canaryArrivalAt ? settings.canaryArrivalAt : settings.spainArrivalAt);
      apply(
        target,
        formatArrivalDate(target, canary ? (settings.canaryTimezone || 'Atlantic/Canary') : (settings.spainTimezone || 'Europe/Madrid')),
        'Fecha ajustada a España · detección por zona horaria.',
      );
      return;
    }
    useDefault();
  };

  if (!settings.spainArrivalAt || !navigator.geolocation) return fallback();

  navigator.geolocation.getCurrentPosition(({ coords }) => {
    const { latitude, longitude } = coords;
    const boxes = [
      [35.7, 43.9, -9.6, 4.6],
      [38.5, 40.2, 1, 4.5],
      [27.5, 29.6, -18.3, -13.2],
      [35.7, 36, -5.5, -5.1],
      [35.1, 35.4, -3.1, -2.8],
    ];
    const inSpain = boxes.some(([south, north, west, east]) => latitude >= south && latitude <= north && longitude >= west && longitude <= east);
    if (!inSpain) return useDefault();

    const canary = latitude >= 27.5 && latitude <= 29.6 && longitude >= -18.3 && longitude <= -13.2;
    const target = new Date(canary && settings.canaryArrivalAt ? settings.canaryArrivalAt : settings.spainArrivalAt);
    apply(
      target,
      formatArrivalDate(target, canary ? (settings.canaryTimezone || 'Atlantic/Canary') : (settings.spainTimezone || 'Europe/Madrid')),
      'Fecha ajustada a España · detección por ubicación.',
    );
  }, fallback, { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 });
}

function formatArrivalDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone,
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return `🏰 ${value('day')} · ${value('month').replace('.', '').toUpperCase()} · ${value('year')}`;
}

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus($('authStatus'), 'Ingresando…');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim().toLowerCase(),
    password: $('password').value,
  });
  if (error) return setStatus($('authStatus'), 'Email o contraseña incorrectos.', 'error');
  await authorize(data.user);
});

$('changePasswordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $('newPassword').value;
  if (password !== $('confirmPassword').value) return setStatus($('authStatus'), 'Las contraseñas no coinciden.', 'error');
  if (!STRONG_PASSWORD_RE.test(password)) return setStatus($('authStatus'), 'Usá al menos 8 caracteres con mayúscula, minúscula, número y símbolo.', 'error');

  setStatus($('authStatus'), 'Actualizando contraseña…');
  try {
    await systemUserApi('complete-password', { password });
    await supabase.auth.signOut();
    $('changePasswordForm').reset();
    $('loginForm').reset();
    currentUser = null;
    currentProfile = null;
    showLogin('Contraseña actualizada. Iniciá sesión nuevamente.', 'ok');
  } catch (error) {
    setStatus($('authStatus'), error.message, 'error');
  }
});

$('tripMemberForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const selected = [...$('availableUsersList').querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  if (!selected.length) return setStatus($('tripMemberStatus'), 'Seleccioná al menos un usuario.', 'error');

  setStatus($('tripMemberStatus'), 'Agregando usuarios…');
  try {
    await Promise.all(selected.map((userId) => tripApi('assign', {
      tripId: currentTrip.id,
      userId,
      role: $('tripMemberRole').value,
    })));
    setStatus($('tripMemberStatus'), 'Usuarios agregados al viaje.', 'ok');
    await loadTripAdminData();
  } catch (error) {
    setStatus($('tripMemberStatus'), error.message, 'error');
  }
});

$('systemUserForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayNameValue = $('systemUserName').value.trim();
  const emailValue = $('systemUserEmail').value.trim().toLowerCase();
  const assignments = collectAssignments();
  setStatus($('systemUserFormStatus'), 'Guardando…');

  try {
    if (editingUserId) {
      await systemUserApi('update', {
        userId: editingUserId,
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

    systemData = await systemUserApi('list');
    renderSystemUsers();
    clearUserEditor();
    setStatus($('userManagerStatus'), 'Usuario guardado.', 'ok');
  } catch (error) {
    setStatus($('systemUserFormStatus'), error.message, 'error');
  }
});

$('manageUsersButton').addEventListener('click', openUserManager);
$('newSystemUserButton').addEventListener('click', clearUserEditor);
$('cancelSystemUserEdit').addEventListener('click', clearUserEditor);
$('changeTripButton').addEventListener('click', changeTrip);
$('logoutButton').addEventListener('click', logout);
$('tripGateLogout').addEventListener('click', logout);

window.addEventListener('DOMContentLoaded', async () => {
  privateModal = new bootstrap.Modal($('privateModal'));
  userManagerModal = new bootstrap.Modal($('userManagerModal'));
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await authorize(session.user);
  else showLogin();
});
