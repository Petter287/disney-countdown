import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/+esm';

const SUPABASE_URL = 'https://ezkjmskkfepgeupampdd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sm6ncjG2aPyk5mCnDCLFlg_yzW5rczE';
const ACCESS_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/invite-trip-member`;
const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (id) => document.getElementById(id);

const authGate = $('authGate');
const tripGate = $('tripGate');
const tripList = $('tripList');
const tripGateStatus = $('tripGateStatus');
const tripShell = $('tripShell');
const loginFields = $('loginFields');
const passwordGate = $('changePasswordForm');
const authStatus = $('authStatus');
const adminPanel = $('adminPanel');
const memberStatus = $('memberStatus');
const membersContainer = $('members');
const memberRole = $('memberRole');

let currentUser = null;
let currentTrip = null;
let currentMembership = null;
let tripMemberships = [];
let roles = [];
let privateModal;
let countdownTimer;

function setStatus(element, message = '', type = '') {
  element.textContent = message;
  element.className = `small mt-2 ${type === 'error' ? 'text-danger' : type === 'ok' ? 'text-success' : 'trip-muted'}`;
}

function resetMemberForm() {
  $('memberForm').reset();
  const viewer = roles.find((role) => role.code === 'viewer');
  if (viewer) memberRole.value = viewer.code;
  setStatus(memberStatus);
}

function clearTripUi() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  currentTrip = null;
  currentMembership = null;
  tripShell.replaceChildren();
  tripShell.classList.remove('visible');
  tripShell.setAttribute('aria-hidden', 'true');
  adminPanel.classList.remove('visible');
  membersContainer.replaceChildren();
  resetMemberForm();
}

function hideAllGates() {
  authGate.classList.add('hidden');
  tripGate.classList.remove('visible');
  tripGate.setAttribute('aria-hidden', 'true');
}

function showLogin(message = '', type = '') {
  clearTripUi();
  tripMemberships = [];
  tripList.replaceChildren();
  tripGate.classList.remove('visible');
  tripGate.setAttribute('aria-hidden', 'true');
  authGate.classList.remove('hidden');
  loginFields.classList.remove('d-none');
  passwordGate.classList.remove('visible');
  setStatus(authStatus, message, type);
}

function showTripPicker() {
  clearTripUi();
  authGate.classList.add('hidden');
  tripGate.classList.add('visible');
  tripGate.setAttribute('aria-hidden', 'false');
}

async function callAccessApi(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('SESSION_EXPIRED');

  const response = await fetch(ACCESS_FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'No se pudo completar la operación.');
    error.status = response.status;
    throw error;
  }
  return body;
}

async function loadUserTrips(user) {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip_id,role_id,is_owner,must_change_password,roles(code,name),trips(id,slug,name,destination,starts_on,ends_on)')
    .eq('user_id', user.id)
    .order('created_at');

  if (error) {
    console.error('Unable to load trips', error);
    return null;
  }
  return data || [];
}

function renderTripPicker() {
  tripList.replaceChildren();

  for (const membership of tripMemberships) {
    const trip = membership.trips;
    if (!trip) continue;

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'trip-card w-100 text-start p-4';

    const title = document.createElement('div');
    title.className = 'd-flex align-items-center justify-content-between gap-3 mb-2';
    const name = document.createElement('strong');
    name.className = 'fs-5';
    name.textContent = `✈️ ${trip.name}`;
    const badge = document.createElement('span');
    badge.className = 'badge role-badge';
    badge.textContent = membership.roles?.name || 'Sin rol';
    title.append(name, badge);

    const destination = document.createElement('div');
    destination.className = 'trip-muted';
    destination.textContent = trip.destination;

    const hint = document.createElement('div');
    hint.className = 'small mt-3';
    hint.textContent = 'Abrir viaje →';

    button.append(title, destination, hint);
    button.addEventListener('click', () => openTrip(membership));
    col.append(button);
    tripList.append(col);
  }

  setStatus(tripGateStatus, tripMemberships.length ? '' : 'No tenés viajes disponibles.', tripMemberships.length ? '' : 'error');
}

async function authorize(user) {
  currentUser = user;
  tripMemberships = await loadUserTrips(user);

  if (!tripMemberships) {
    await supabase.auth.signOut();
    showLogin('No se pudieron cargar tus accesos.', 'error');
    return;
  }

  if (!tripMemberships.length) {
    await supabase.auth.signOut();
    showLogin('Tu cuenta existe, pero no tenés acceso a ningún viaje.', 'error');
    return;
  }

  if (tripMemberships.some((membership) => membership.must_change_password)) {
    clearTripUi();
    tripGate.classList.remove('visible');
    loginFields.classList.add('d-none');
    passwordGate.classList.add('visible');
    authGate.classList.remove('hidden');
    setStatus(authStatus, 'Por seguridad, cambiá la contraseña temporal antes de continuar.');
    return;
  }

  renderTripPicker();
  showTripPicker();
}

async function getTripSettings(tripId) {
  const { data, error } = await supabase
    .from('trip_settings')
    .select('trip_id,eyebrow,title,subtitle,start_at,default_arrival_at,spain_arrival_at,canary_arrival_at')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error || !data) {
    console.error('Unable to load trip settings', error);
    return null;
  }
  return data;
}

function renderTripShell(settings) {
  tripShell.innerHTML = `
    <button id="openTrip" class="btn btn-dark position-fixed top-0 end-0 m-3 rounded-pill z-3" type="button">✨ Mi viaje</button>
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
        <p class="photo-credit mb-0">Foto del castillo: Gsink / Wikimedia Commons · CC0</p>
      </section>
    </main>`;

  $('tripEyebrow').textContent = settings.eyebrow;
  $('tripTitle').textContent = settings.title;
  $('tripSubtitle').textContent = settings.subtitle;
  $('openTrip').addEventListener('click', () => privateModal.show());
  $('quickChangeTrip').addEventListener('click', changeTrip);
  tripShell.setAttribute('aria-hidden', 'false');
}

function renderUserLine() {
  const userLine = $('userLine');
  const badge = document.createElement('span');
  badge.className = 'badge role-badge';
  badge.textContent = currentMembership?.roles?.name || 'Sin rol';
  userLine.replaceChildren(document.createTextNode(`${currentUser?.email || ''} · `), badge);
}

async function openTrip(membership) {
  const trip = membership.trips;
  if (!trip) return;

  const settings = await getTripSettings(trip.id);
  if (!settings) {
    setStatus(tripGateStatus, 'No se pudo cargar la configuración de este viaje.', 'error');
    return;
  }

  currentTrip = trip;
  currentMembership = membership;
  hideAllGates();
  renderTripShell(settings);
  tripShell.classList.add('visible');
  $('privateTripTitle').textContent = `✨ ${trip.name}`;
  renderUserLine();

  const isAdmin = membership.roles?.code === 'admin';
  adminPanel.classList.toggle('visible', isAdmin);
  if (isAdmin) {
    await loadRoles();
    await loadMembers();
  } else {
    membersContainer.replaceChildren();
  }

  startCountdown(settings);
}

async function loadRoles() {
  const { data, error } = await supabase.from('roles').select('id,code,name').order('id');
  if (error) {
    setStatus(memberStatus, 'No se pudieron cargar los roles.', 'error');
    return;
  }

  roles = data || [];
  memberRole.replaceChildren();
  for (const role of roles) {
    const option = document.createElement('option');
    option.value = role.code;
    option.textContent = role.name;
    memberRole.append(option);
  }
  resetMemberForm();
}

function buildMemberRow(member) {
  const row = document.createElement('div');
  row.className = 'member-row p-3 d-flex flex-column flex-md-row gap-2 align-items-md-center';

  const info = document.createElement('div');
  info.className = 'me-auto';
  const email = document.createElement('strong');
  email.textContent = member.profiles?.email || 'Usuario';
  const roleName = document.createElement('div');
  roleName.className = 'small trip-muted';
  roleName.textContent = member.roles?.name || '';
  info.append(email, roleName);
  row.append(info);

  if (member.is_owner) {
    const ownerBadge = document.createElement('span');
    ownerBadge.className = 'badge role-badge';
    ownerBadge.textContent = 'Propietario';
    row.append(ownerBadge);
    return row;
  }

  const roleSelect = document.createElement('select');
  roleSelect.className = 'form-select form-select-sm w-auto';
  for (const role of roles) {
    const option = document.createElement('option');
    option.value = role.code;
    option.textContent = role.name;
    option.selected = role.id === member.role_id;
    roleSelect.append(option);
  }

  roleSelect.addEventListener('change', async () => {
    roleSelect.disabled = true;
    try {
      await callAccessApi({ action: 'update-role', tripId: currentTrip.id, email: member.profiles.email, role: roleSelect.value });
      setStatus(memberStatus, 'Rol actualizado.', 'ok');
      await loadMembers();
    } catch (error) {
      setStatus(memberStatus, error.message === 'SESSION_EXPIRED' ? 'La sesión venció.' : error.message, 'error');
      await loadMembers();
    }
  });

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'btn btn-outline-danger btn-sm';
  removeButton.textContent = 'Quitar';
  removeButton.addEventListener('click', async () => {
    removeButton.disabled = true;
    try {
      await callAccessApi({ action: 'remove', tripId: currentTrip.id, email: member.profiles.email });
      setStatus(memberStatus, 'Acceso quitado de este viaje. La cuenta se conserva.', 'ok');
      await loadMembers();
    } catch (error) {
      removeButton.disabled = false;
      setStatus(memberStatus, error.message === 'SESSION_EXPIRED' ? 'La sesión venció.' : error.message, 'error');
    }
  });

  row.append(roleSelect, removeButton);
  return row;
}

async function loadMembers() {
  if (!currentTrip) return;
  const { data, error } = await supabase
    .from('trip_members')
    .select('user_id,role_id,is_owner,roles(code,name),profiles(email,display_name)')
    .eq('trip_id', currentTrip.id)
    .order('created_at');

  if (error) {
    console.error('Unable to load members', error);
    setStatus(memberStatus, 'No se pudo cargar la lista de miembros.', 'error');
    return;
  }

  membersContainer.replaceChildren(...(data || []).map(buildMemberRow));
}

function changeTrip() {
  if (privateModal) privateModal.hide();
  renderTripPicker();
  showTripPicker();
}

async function logout() {
  if (privateModal) privateModal.hide();
  clearTripUi();
  await supabase.auth.signOut();
  currentUser = null;
  tripMemberships = [];
  $('loginForm').reset();
  passwordGate.reset();
  showLogin();
}

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(authStatus, 'Ingresando…');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim().toLowerCase(),
    password: $('password').value,
  });

  if (error) {
    setStatus(authStatus, 'Email o contraseña incorrectos.', 'error');
    return;
  }
  await authorize(data.user);
});

passwordGate.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $('newPassword').value;
  const confirmation = $('confirmPassword').value;

  if (password !== confirmation) {
    setStatus(authStatus, 'Las contraseñas no coinciden.', 'error');
    return;
  }
  if (!STRONG_PASSWORD_RE.test(password)) {
    setStatus(authStatus, 'Usá al menos 8 caracteres con mayúscula, minúscula, número y símbolo.', 'error');
    return;
  }

  setStatus(authStatus, 'Actualizando contraseña…');
  try {
    await callAccessApi({ action: 'complete-password', password });
    await supabase.auth.signOut();
    currentUser = null;
    passwordGate.reset();
    passwordGate.classList.remove('visible');
    loginFields.classList.remove('d-none');
    $('loginForm').reset();
    setStatus(authStatus, 'Contraseña actualizada. Iniciá sesión nuevamente.', 'ok');
  } catch (error) {
    setStatus(authStatus, error.message === 'SESSION_EXPIRED' ? 'La sesión venció.' : error.message, 'error');
  }
});

$('memberForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentTrip) return;

  const email = $('memberEmail').value.trim().toLowerCase();
  const role = memberRole.value;
  const temporaryPassword = $('temporaryPassword').value;

  if (temporaryPassword && !STRONG_PASSWORD_RE.test(temporaryPassword)) {
    setStatus(memberStatus, 'La contraseña temporal debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo.', 'error');
    return;
  }

  setStatus(memberStatus, 'Procesando acceso…');
  try {
    const result = await callAccessApi({ action: 'create', tripId: currentTrip.id, email, role, temporaryPassword });
    resetMemberForm();
    setStatus(
      memberStatus,
      result.existingUser
        ? 'Acceso agregado a una cuenta existente. Conserva su contraseña actual.'
        : 'Usuario creado. Compartile la contraseña temporal por un medio seguro.',
      'ok',
    );
    await loadMembers();
  } catch (error) {
    setStatus(memberStatus, error.message === 'SESSION_EXPIRED' ? 'La sesión venció.' : error.message, 'error');
  }
});

$('changeTripButton').addEventListener('click', changeTrip);
$('logoutButton').addEventListener('click', logout);
$('tripGateLogout').addEventListener('click', logout);
$('privateModal').addEventListener('hidden.bs.modal', resetMemberForm);

function startCountdown(settings) {
  const start = new Date(settings.start_at);
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
      const percent = Math.min(100, Math.max(0, ((now - start) / (target - start)) * 100));
      $('progressBar').style.width = `${percent}%`;
      $('progressText').textContent = `${percent.toFixed(1)}%`;
    };

    tick();
    countdownTimer = setInterval(tick, 1000);
  };

  const fallback = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (spainZones.has(timezone)) {
      const target = timezone === 'Atlantic/Canary' ? new Date(settings.canary_arrival_at) : new Date(settings.spain_arrival_at);
      apply(target, formatArrivalDate(target), 'Fecha ajustada a España · detección por zona horaria.');
      return;
    }
    const target = new Date(settings.default_arrival_at);
    apply(target, formatArrivalDate(target), 'Fecha de llegada según el viaje seleccionado.');
  };

  if (!navigator.geolocation) return fallback();

  navigator.geolocation.getCurrentPosition(({ coords }) => {
    const { latitude, longitude } = coords;
    const boxes = [
      [35.7, 43.9, -9.6, 4.6], [38.5, 40.2, 1, 4.5], [27.5, 29.6, -18.3, -13.2],
      [35.7, 36.0, -5.5, -5.1], [35.1, 35.4, -3.1, -2.8],
    ];
    const inSpain = boxes.some(([south, north, west, east]) => latitude >= south && latitude <= north && longitude >= west && longitude <= east);
    if (!inSpain) return fallback();

    const inCanaryIslands = latitude >= 27.5 && latitude <= 29.6 && longitude >= -18.3 && longitude <= -13.2;
    const target = new Date(inCanaryIslands ? settings.canary_arrival_at : settings.spain_arrival_at);
    apply(target, formatArrivalDate(target), 'Fecha ajustada a España · detección por ubicación.');
  }, fallback, { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 });
}

function formatArrivalDate(date) {
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `🏰 ${String(date.getDate()).padStart(2, '0')} · ${months[date.getMonth()]} · ${date.getFullYear()}`;
}

window.addEventListener('DOMContentLoaded', async () => {
  privateModal = new bootstrap.Modal($('privateModal'));
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await authorize(session.user);
  else showLogin();
});