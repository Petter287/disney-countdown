import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/+esm';

const SUPABASE_URL = 'https://ezkjmskkfepgeupampdd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sm6ncjG2aPyk5mCnDCLFlg_yzW5rczE';
const ACCESS_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/invite-trip-member`;
const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (id) => document.getElementById(id);

const passwordGate = $('changePasswordForm');
const authStatus = $('authStatus');
const memberStatus = $('memberStatus');
const tripShell = $('tripShell');
const authGate = $('authGate');
const loginFields = $('loginFields');
const adminPanel = $('adminPanel');
const membersContainer = $('members');
const memberRole = $('memberRole');

let membership = null;
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

function lockTrip() {
  clearInterval(countdownTimer);
  tripShell.classList.remove('visible');
  authGate.classList.remove('hidden');
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

async function getMember(user) {
  if (!user?.email) return null;
  const { data, error } = await supabase
    .from('trip_members')
    .select('email,display_name,role_id,is_owner,must_change_password,roles(code,name)')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('Unable to load membership', error);
    return null;
  }
  return data;
}

function renderUserLine(user) {
  const userLine = $('userLine');
  const badge = document.createElement('span');
  badge.className = 'badge role-badge';
  badge.textContent = membership?.roles?.name || 'Sin rol';

  userLine.replaceChildren(
    document.createTextNode(`${user.email} · `),
    badge,
  );
}

async function authorize(user) {
  membership = await getMember(user);
  if (!membership) {
    await supabase.auth.signOut();
    lockTrip();
    setStatus(authStatus, 'No tenés acceso a este viaje.', 'error');
    return false;
  }

  if (membership.must_change_password) {
    loginFields.classList.add('d-none');
    passwordGate.classList.add('visible');
    authGate.classList.remove('hidden');
    setStatus(authStatus, 'Por seguridad, cambiá la contraseña temporal antes de continuar.');
    return false;
  }

  authGate.classList.add('hidden');
  tripShell.classList.add('visible');
  renderUserLine(user);

  const isAdmin = membership.roles?.code === 'admin';
  adminPanel.classList.toggle('visible', isAdmin);
  if (isAdmin) {
    await loadRoles();
    await loadMembers();
  }

  startCountdown();
  return true;
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
  email.textContent = member.email;
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
  roleSelect.className = 'form-select form-select-sm role-change w-auto';
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
      await callAccessApi({ action: 'update-role', email: member.email, role: roleSelect.value });
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
      await callAccessApi({ action: 'remove', email: member.email });
      setStatus(memberStatus, 'Acceso eliminado. La cuenta de autenticación se conserva.', 'ok');
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
  const { data, error } = await supabase
    .from('trip_members')
    .select('email,role_id,is_owner,roles(code,name)')
    .order('email');

  if (error) {
    setStatus(memberStatus, 'No se pudo cargar la lista.', 'error');
    return;
  }

  membersContainer.replaceChildren(...(data || []).map(buildMemberRow));
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
    setStatus(authStatus, 'Usá al menos 12 caracteres con mayúscula, minúscula, número y símbolo.', 'error');
    return;
  }

  setStatus(authStatus, 'Actualizando contraseña…');
  try {
    await callAccessApi({ action: 'complete-password', password });
    await supabase.auth.signOut();
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
  const email = $('memberEmail').value.trim().toLowerCase();
  const role = memberRole.value;
  const temporaryPassword = $('temporaryPassword').value;

  if (temporaryPassword && !STRONG_PASSWORD_RE.test(temporaryPassword)) {
    setStatus(memberStatus, 'La contraseña temporal debe tener al menos 12 caracteres con mayúscula, minúscula, número y símbolo.', 'error');
    return;
  }

  setStatus(memberStatus, 'Procesando acceso…');
  try {
    const result = await callAccessApi({ action: 'create', email, role, temporaryPassword });
    resetMemberForm();
    if (result.existingUser) {
      setStatus(memberStatus, 'Acceso agregado a una cuenta existente. Conserva su contraseña actual.', 'ok');
    } else {
      setStatus(memberStatus, 'Usuario creado. Compartile la contraseña temporal por un medio seguro.', 'ok');
    }
    await loadMembers();
  } catch (error) {
    setStatus(memberStatus, error.message === 'SESSION_EXPIRED' ? 'La sesión venció.' : error.message, 'error');
  }
});

$('openTrip').addEventListener('click', () => privateModal.show());

$('logoutButton').addEventListener('click', async () => {
  privateModal.hide();
  resetMemberForm();
  await supabase.auth.signOut();
  membership = null;
  $('loginForm').reset();
  passwordGate.reset();
  loginFields.classList.remove('d-none');
  passwordGate.classList.remove('visible');
  setStatus(authStatus);
  lockTrip();
});

$('privateModal').addEventListener('hidden.bs.modal', resetMemberForm);

function startCountdown() {
  const start = new Date('2026-09-02T00:00:00-03:00');
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
      const target = timezone === 'Atlantic/Canary'
        ? new Date('2027-01-10T00:00:00+00:00')
        : new Date('2027-01-10T00:00:00+01:00');
      apply(target, '🏰 10 · ENE · 2027', 'Fecha ajustada a España · detección por zona horaria.');
      return;
    }
    apply(new Date('2027-01-12T00:00:00-05:00'), '🏰 12 · ENE · 2027', 'Llegada a Orlando · 12 de enero de 2027.');
  };

  if (!navigator.geolocation) {
    fallback();
    return;
  }

  navigator.geolocation.getCurrentPosition(({ coords }) => {
    const { latitude, longitude } = coords;
    const boxes = [
      [35.7, 43.9, -9.6, 4.6],
      [38.5, 40.2, 1, 4.5],
      [27.5, 29.6, -18.3, -13.2],
      [35.7, 36.0, -5.5, -5.1],
      [35.1, 35.4, -3.1, -2.8],
    ];
    const inSpain = boxes.some(([south, north, west, east]) =>
      latitude >= south && latitude <= north && longitude >= west && longitude <= east,
    );
    if (!inSpain) {
      fallback();
      return;
    }

    const inCanaryIslands = latitude >= 27.5 && latitude <= 29.6 && longitude >= -18.3 && longitude <= -13.2;
    const target = inCanaryIslands
      ? new Date('2027-01-10T00:00:00+00:00')
      : new Date('2027-01-10T00:00:00+01:00');
    apply(target, '🏰 10 · ENE · 2027', 'Fecha ajustada a España · detección por ubicación.');
  }, fallback, {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 3600000,
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  privateModal = new bootstrap.Modal($('privateModal'));
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await authorize(session.user);
  else lockTrip();
});
