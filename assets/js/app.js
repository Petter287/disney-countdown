import { secureSignOut, supabase, tripApi } from './api.js';
import { bindAuth } from './auth/auth.js';
import { bindRouter, currentRoute, navigate, tripPath } from './router.js';
import { $, setStatus } from './shared/dom.js';
import { purgePrivateSessionData } from './shared/session-security.js';
import { state } from './state.js';
import { startCountdown, stopCountdown } from './trips/countdown.js';
import { bindTripAdminForm, loadTripAdminData } from './trips/trip-admin.js';
import { renderTripPicker } from './trips/trip-picker.js';
import { renderTripShell } from './trips/trip-view.js';
import { bindUserManager, openUserManager } from './users/user-manager.js';

let handlingExpiredSession = false;

function clearTripUi() {
  stopCountdown();
  state.currentTrip = null;
  state.currentMembership = null;
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

function openTripRoute(membership) {
  const slug = membership?.trip?.slug;
  if (!slug) return;
  navigate(tripPath(slug));
}

function refreshTripPicker() {
  renderTripPicker(state.currentProfile, state.tripMemberships, openTripRoute);
}

async function handleExpiredSession() {
  if (handlingExpiredSession) return;
  handlingExpiredSession = true;

  if (state.privateModal) state.privateModal.hide();
  if (state.userManagerModal) state.userManagerModal.hide();
  purgePrivateSessionData();
  navigate('/', { replace: true });
  showLogin('Tu sesión venció. Iniciá sesión nuevamente.', 'error');

  try {
    await secureSignOut();
  } catch {
    // The private UI and application state are already purged locally.
  } finally {
    handlingExpiredSession = false;
  }
}

async function authorize(user) {
  state.currentUser = user;
  try {
    const bootstrap = await tripApi('bootstrap');
    state.currentProfile = bootstrap.profile;
    state.tripMemberships = bootstrap.memberships || [];
  } catch (error) {
    if (error.message === 'SESSION_EXPIRED') return;
    try {
      await secureSignOut();
    } finally {
      purgePrivateSessionData();
      showLogin(error.message || 'No se pudo validar tu acceso.', 'error');
    }
    return;
  }

  if (state.currentProfile.mustChangePassword) {
    clearTripUi();
    $('tripGate').classList.remove('visible');
    $('loginFields').classList.add('d-none');
    $('changePasswordForm').classList.add('visible');
    $('authGate').classList.remove('hidden');
    setStatus($('authStatus'), 'Por seguridad, cambiá la contraseña temporal antes de continuar.');
    return;
  }

  await applyRoute(currentRoute());
}

async function openTrip(membership) {
  const trip = membership.trip;
  if (!trip) return;

  setStatus($('tripGateStatus'), 'Cargando viaje…');
  let settings;
  let permissions = membership.permissions || [];
  try {
    const result = await tripApi('trip-detail', { slug: trip.slug });
    settings = result.settings;
    permissions = result.permissions || permissions;
  } catch (error) {
    if (error.message === 'SESSION_EXPIRED') return;
    showTripPicker();
    refreshTripPicker();
    setStatus($('tripGateStatus'), error.message || 'No se pudo cargar la configuración del viaje.', 'error');
    return;
  }

  state.currentTrip = trip;
  state.currentMembership = { ...membership, permissions };
  $('authGate').classList.add('hidden');
  $('tripGate').classList.remove('visible');
  renderTripShell(settings, {
    onOpenDetails: () => state.privateModal.show(),
    onChangeTrip: changeTrip,
  });
  $('tripShell').classList.add('visible');
  $('privateTripTitle').textContent = `✨ ${trip.name}`;
  $('userLine').textContent = `${state.currentProfile.email} · ${membership.role?.name || 'Sin rol'}`;

  const canManageMembers = permissions.includes('members.manage');
  $('adminPanel').classList.toggle('visible', canManageMembers);
  if (canManageMembers) await loadTripAdminData();
  startCountdown(settings);
}

function changeTrip() {
  if (state.privateModal) state.privateModal.hide();
  if (!navigate('/')) {
    refreshTripPicker();
    showTripPicker();
  }
}

async function applyRoute(route) {
  if (!state.currentProfile) return;

  if (route.name === 'not-found') {
    navigate('/', { replace: true });
    return;
  }

  if (route.name === 'users') {
    if (!state.currentProfile.systemOwner) {
      navigate('/', { replace: true });
      return;
    }

    if (state.privateModal) state.privateModal.hide();
    refreshTripPicker();
    showTripPicker();
    await openUserManager();
    return;
  }

  if (state.userManagerModal) state.userManagerModal.hide();

  if (route.name === 'trip') {
    const membership = state.tripMemberships.find((item) => item.trip?.slug === route.slug);
    if (!membership) {
      refreshTripPicker();
      showTripPicker();
      setStatus($('tripGateStatus'), 'No tenés acceso al viaje solicitado.', 'error');
      return;
    }

    await openTrip(membership);
    return;
  }

  if (state.privateModal) state.privateModal.hide();
  refreshTripPicker();
  showTripPicker();
}

async function logout() {
  if (state.privateModal) state.privateModal.hide();
  if (state.userManagerModal) state.userManagerModal.hide();

  try {
    await secureSignOut();
  } finally {
    purgePrivateSessionData();
    navigate('/', { replace: true });
    showLogin();
  }
}

function bindNavigation() {
  $('changeTripButton').addEventListener('click', changeTrip);
  $('logoutButton').addEventListener('click', logout);
  $('tripGateLogout').addEventListener('click', logout);
  $('userManagerModal').addEventListener('hidden.bs.modal', () => {
    if (currentRoute().name === 'users') navigate('/');
  });
  window.addEventListener('app:session-expired', handleExpiredSession);
}

window.addEventListener('DOMContentLoaded', async () => {
  state.privateModal = new bootstrap.Modal($('privateModal'));
  state.userManagerModal = new bootstrap.Modal($('userManagerModal'));

  bindRouter(applyRoute);
  bindAuth({ authorize, showLogin });
  bindTripAdminForm();
  bindUserManager({ onOpen: () => navigate('/users') });
  bindNavigation();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await authorize(session.user);
  else {
    purgePrivateSessionData();
    showLogin();
  }
});
