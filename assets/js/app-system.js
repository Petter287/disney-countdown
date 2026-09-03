import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/+esm';

const SUPABASE_URL = 'https://ezkjmskkfepgeupampdd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sm6ncjG2aPyk5mCnDCLFlg_yzW5rczE';
const TRIP_MEMBER_API = `${SUPABASE_URL}/functions/v1/invite-trip-member`;
const SYSTEM_USER_API = `${SUPABASE_URL}/functions/v1/manage-system-user`;
const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
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

async function callFunction(url, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('SESSION_EXPIRED');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

const callTripApi = (payload) => callFunction(TRIP_MEMBER_API, payload);
const callSystemApi = (payload) => callFunction(SYSTEM_USER_API, payload);

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

async function loadOwnProfile(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,email,display_name,system_access_enabled,is_system_owner,must_change_password')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) console.error('Unable to load profile', error);
  return error ? null : data;
}

async function loadUserTrips(user) {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip_id,role_id,is_owner,roles(code,name),trips(id,slug,name,destination,starts_on,ends_on)')
    .eq('user_id', user.id)
    .order('created_at');
  if (error) {
    console.error('Unable to load trips', error);
    return null;
  }
  return data || [];
}

function displayName(profile) {
  return profile?.display_name?.trim() || profile?.email?.split('@')[0] || 'viajero';
}

function renderTripPicker() {
  $('tripGreeting').textContent = `Hola, ${displayName(currentProfile)} 👋`;
  $('systemOwnerActions').classList.toggle('visible', currentProfile?.is_system_owner === true);
  $('tripList').replaceChildren();

  for (const membership of tripMemberships) {
    const trip = membership.trips;
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
    badge.textContent = membership.roles?.name || 'Sin rol';
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
  currentProfile = await loadOwnProfile(user);
  if (!currentProfile || !currentProfile.system_access_enabled) {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showLogin('Tu cuenta no tiene acceso habilitado al sistema.', 'error');
    return;
  }

  if (currentProfile.must_change_password) {
    clearTripUi();
    $('tripGate').classList.remove('visible');
    $('loginFields').classList.add('d-none');
    $('changePasswordForm').classList.add('visible');
    $('authGate').classList.remove('hidden');
    setStatus($('authStatus'), 'Por seguridad, cambiá la contraseña temporal antes de continuar.');
    return;
  }

  tripMemberships = await loadUserTrips(user);
  if (!tripMemberships) {
    await supabase.auth.signOut();
    showLogin('No se pudieron cargar tus viajes.', 'error');
    return;
  }
  renderTripPicker();
  showTripPicker();
}

async function getTripSettings(tripId) {
  const { data, error } = await supabase
    .from('trip_settings')
    .select('trip_id,eyebrow,title,subtitle,start_at,default_arrival_at,spain_arrival_at,canary_arrival_at,background_url,photo_credit,default_timezone,spain_timezone,canary_timezone')
    .eq('trip_id', tripId)
    .maybeSingle();
  if (error || !data) console.error('Unable to load trip settings', error);
  return error ? null : data;
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
  $('photoCredit').textContent = settings.photo_credit || '';
  if (settings.background_url) {
    try {
      const url = new URL(settings.background_url);
      if (url.protocol === 'https:') shell.style.setProperty('--trip-background-image', `url("${url.href}")`);
    } catch { /* use default */ }
  }
  $('openTripDetails').addEventListener('click', () => privateModal.show());
  $('quickChangeTrip').addEventListener('click', changeTrip);
  shell.setAttribute('aria-hidden', 'false');
}

async function openTrip(membership) {
  const trip = membership.trips;
  if (!trip) return;
  const settings = await getTripSettings(trip.id);
  if (!settings) {
    setStatus($('tripGateStatus'), 'No se pudo cargar la configuración del viaje.', 'error');
    return;
  }

  currentTrip = trip;
  currentMembership = membership;
  $('authGate').classList.add('hidden');
  $('tripGate').classList.remove('visible');
  renderTripShell(settings);
  $('tripShell').classList.add('visible');
  $('privateTripTitle').textContent = `✨ ${trip.name}`;
  $('userLine').textContent = `${currentProfile.email} · ${membership.roles?.name || 'Sin rol'}`;

  const canManage = currentProfile.is_system_owner || membership.roles?.code === 'admin';
  $('adminPanel').classList.toggle('visible', canManage);
  if (canManage) await loadTripAdminData();
  startCountdown(settings);
}

async function loadRoles() {
  const { data, error } = await supabase.from('roles').select('id,code,name').order('id');
  if (error) throw error;
  roles = data || [];
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

async function loadTripMembers() {
  const { data, error } = await supabase
    .from('trip_members')
    .select('user_id,role_id,is_owner,roles(code,name),profiles(email,display_name,system_access_enabled)')
    .eq('trip_id', currentTrip.id)
    .order('created_at');
  if (error) {
    setStatus($('tripMemberStatus'), 'No se pudo cargar la lista de miembros.', 'error');
    return;
  }

  $('members').replaceChildren(...(data || []).map((member) => {
    const row = document.createElement('div');
    row.className = 'member-row p-3 d-flex flex-column flex-md-row gap-2 align-items-md-center';
    const info = document.createElement('div');
    info.className = 'me-auto';
    const strong = document.createElement('strong');
    strong.textContent = member.profiles?.display_name || member.profiles?.email || 'Usuario';
    const detail = document.createElement('div');
    detail.className = 'small trip-muted';
    detail.textContent = `${member.profiles?.email || ''}${member.profiles?.system_access_enabled === false ? ' · Acceso global deshabilitado' : ''}`;
    info.append(strong, detail);
    row.append(info);

    if (member.is_owner) {
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
      option.selected = role.id === member.role_id;
      roleSelect.append(option);
    }
    roleSelect.addEventListener('change', async () => {
      roleSelect.disabled = true;
      try {
        await callTripApi({ action: 'update-role', tripId: currentTrip.id, userId: member.user_id, role: roleSelect.value });
        setStatus($('tripMemberStatus'), 'Rol actualizado.', 'ok');
        await loadTripMembers();
      } catch (error) {
        setStatus($('tripMemberStatus'), error.message, 'error');
        await loadTripMembers();
      }
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-outline-danger btn-sm';
    remove.textContent = 'Quitar del viaje';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await callTripApi({ action: 'remove', tripId: currentTrip.id, userId: member.user_id });
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

async function loadAvailableUsers() {
  const result = await callTripApi({ action: 'list-available', tripId: currentTrip.id });
  const container = $('availableUsersList');
  container.replaceChildren();
  if (!result.users?.length) {
    const empty = document.createElement('div');
    empty.className = 'p-3 small trip-muted';
    empty.textContent = 'No hay otros usuarios activos disponibles.';
    container.append(empty);
    return;
  }
  for (const user of result.users) {
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
    if (!roles.length) await loadRoles();
    await Promise.all([loadTripMembers(), loadAvailableUsers()]);
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
    systemData = await callSystemApi({ action: 'list' });
    renderSystemUsers();
    clearUserEditor();
    setStatus($('userManagerStatus'));
  } catch (error) {
    setStatus($('userManagerStatus'), error.message, 'error');
  }
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
          await callSystemApi({ action: 'toggle-access', userId: user.id, enabled: !user.enabled });
          systemData = await callSystemApi({ action: 'list' });
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
      ? user.memberships.map((m) => `${tripName(m.tripId)} · ${m.isOwner ? 'Propietario' : m.roleName}`).join(' | ')
      : 'Sin viajes asignados';
    card.append(top, assignments);
    container.append(card);
  }
}

function tripName(tripId) {
  return systemData.trips?.find((trip) => trip.id === tripId)?.name || 'Viaje';
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
      const denominator = target - start;
      const percent = denominator > 0 ? Math.min(100, Math.max(0, ((now - start) / denominator) * 100)) : 100;
      $('progressBar').style.width = `${percent}%`;
      $('progressText').textContent = `${percent.toFixed(1)}%`;
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  };

  const useDefault = () => {
    const target = new Date(settings.default_arrival_at);
    apply(target, formatArrivalDate(target, settings.default_timezone || 'UTC'), 'Fecha de llegada según el viaje seleccionado.');
  };
  const fallback = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (settings.spain_arrival_at && spainZones.has(tz)) {
      const canary = tz === 'Atlantic/Canary';
      const target = new Date(canary && settings.canary_arrival_at ? settings.canary_arrival_at : settings.spain_arrival_at);
      apply(target, formatArrivalDate(target, canary ? (settings.canary_timezone || 'Atlantic/Canary') : (settings.spain_timezone || 'Europe/Madrid')), 'Fecha ajustada a España · detección por zona horaria.');
      return;
    }
    useDefault();
  };

  if (!settings.spain_arrival_at || !navigator.geolocation) return fallback();
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    const { latitude, longitude } = coords;
    const boxes = [[35.7,43.9,-9.6,4.6],[38.5,40.2,1,4.5],[27.5,29.6,-18.3,-13.2],[35.7,36,-5.5,-5.1],[35.1,35.4,-3.1,-2.8]];
    const inSpain = boxes.some(([s,n,w,e]) => latitude >= s && latitude <= n && longitude >= w && longitude <= e);
    if (!inSpain) return useDefault();
    const canary = latitude >= 27.5 && latitude <= 29.6 && longitude >= -18.3 && longitude <= -13.2;
    const target = new Date(canary && settings.canary_arrival_at ? settings.canary_arrival_at : settings.spain_arrival_at);
    apply(target, formatArrivalDate(target, canary ? (settings.canary_timezone || 'Atlantic/Canary') : (settings.spain_timezone || 'Europe/Madrid')), 'Fecha ajustada a España · detección por ubicación.');
  }, fallback, { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 });
}

function formatArrivalDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone }).formatToParts(date);
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
    await callSystemApi({ action: 'complete-password', password });
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
    for (const userId of selected) {
      await callTripApi({ action: 'assign', tripId: currentTrip.id, userId, role: $('tripMemberRole').value });
    }
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
      await callSystemApi({
        action: 'update', userId: editingUserId, displayName: displayNameValue, email: emailValue,
        enabled: $('systemUserEnabled').checked, assignments,
      });
    } else {
      const temporaryPassword = $('systemUserPassword').value;
      if (!STRONG_PASSWORD_RE.test(temporaryPassword)) throw new Error('La contraseña temporal debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo.');
      await callSystemApi({ action: 'create', displayName: displayNameValue, email: emailValue, temporaryPassword, assignments });
    }
    systemData = await callSystemApi({ action: 'list' });
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