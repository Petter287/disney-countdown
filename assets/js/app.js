import { secureSignOut, supabase, tripApi } from './api.js';
import { bindAuth } from './auth/auth.js';
import { bindRouter, currentRoute, navigate, tripEditPath, tripParticipantsPath, tripPath, tripSettingsPath } from './router.js';
import { $, setStatus } from './shared/dom.js';
import { purgePrivateSessionData } from './shared/session-security.js';
import { state } from './state.js';
import { startCountdown, stopCountdown } from './trips/countdown.js';
import { bindTripManager, hideTripManager, showTripManager } from './trips/trip-manager.js';
import { bindTripParticipants, hideTripParticipants, showTripParticipants } from './trips/trip-participants.js';
import { renderTripPicker } from './trips/trip-picker.js';
import { renderTripShell } from './trips/trip-view.js';
import { bindTripSettings, hideTripSettings, showTripSettings } from './trips/trip-settings.js';
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
}

function showLogin(message = '', type = '') {
  hideTripSettings();
  hideTripParticipants();
  hideTripManager();
  clearTripUi();
  $('tripGate').classList.remove('visible');
  $('tripGate').setAttribute('aria-hidden', 'true');
  $('authGate').classList.remove('hidden');
  $('loginFields').classList.remove('d-none');
  $('changePasswordForm').classList.remove('visible');
  setStatus($('authStatus'), message, type);
}

function showTripPicker() {
  hideTripSettings();
  hideTripParticipants();
  hideTripManager();
  clearTripUi();
  $('authGate').classList.add('hidden');
  $('tripGate').classList.add('visible');
  $('tripGate').setAttribute('aria-hidden', 'false');
}

function hideTripPicker() {
  $('tripGate').classList.remove('visible');
  $('tripGate').setAttribute('aria-hidden', 'true');
}

function openTripRoute(access) {
  const slug = access?.trip?.slug;
  if (!slug) return;
  navigate(tripPath(slug));
}

function editTripRoute(access) {
  const slug = access?.trip?.slug;
  if (!slug) return;
  navigate(tripEditPath(slug));
}

function refreshTripPicker() {
  renderTripPicker(
    state.currentProfile,
    state.accessibleTrips,
    openTripRoute,
    editTripRoute,
    (access) => navigate(tripSettingsPath(access.trip.slug)),
    (access) => navigate(tripParticipantsPath(access.trip.slug)),
  );
}

async function reloadBootstrapData() {
  const bootstrap = await tripApi('bootstrap');
  state.currentProfile = bootstrap.profile;
  state.tripMemberships = bootstrap.memberships || [];
  state.accessibleTrips = bootstrap.accessibleTrips || state.tripMemberships.map((membership) => ({
    trip: membership.trip,
    membership,
    permissions: membership.permissions || [],
  }));
}

async function handleExpiredSession() {
  if (handlingExpiredSession) return;
  handlingExpiredSession = true;

  if (state.privateModal) state.privateModal.hide();
  if (state.userManagerModal) state.userManagerModal.hide();
  hideTripSettings();
  hideTripParticipants();
  hideTripManager();
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
    await reloadBootstrapData();
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

async function openTrip(access) {
  const trip = access.trip;
  if (!trip) return;
  const requestingUser = state.currentUser;
  const requestedPath = currentRoute().path;

  hideTripManager();
  hideTripParticipants();
  setStatus($('tripGateStatus'), 'Cargando viaje…');
  let settings;
  let permissions = access.permissions || [];
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

  if (!state.currentProfile || state.currentUser !== requestingUser || currentRoute().path !== requestedPath) return;
  state.currentTrip = trip;
  state.currentMembership = access.membership ? { ...access.membership, permissions } : null;
  $('authGate').classList.add('hidden');
  hideTripPicker();
  renderTripShell(settings, {
    onOpenDetails: () => state.privateModal.show(),
    onChangeTrip: changeTrip,
    onConfigure: permissions.includes('trip.edit') ? () => navigate(tripSettingsPath(trip.slug)) : null,
    onManageParticipants: permissions.includes('members.manage') ? () => navigate(tripParticipantsPath(trip.slug)) : null,
  });
  $('tripShell').classList.add('visible');
  $('privateTripTitle').textContent = `✨ ${trip.name}`;
  const accessLabel = access.membership?.role?.name || (state.currentProfile.systemOwner ? 'System Owner' : 'Sin rol');
  $('userLine').textContent = `${state.currentProfile.email} · ${accessLabel}`;
  startCountdown(settings);
}

function changeTrip() {
  if (state.privateModal) state.privateModal.hide();
  if (!navigate('/')) {
    refreshTripPicker();
    showTripPicker();
  }
}

async function handleTripSaved(trip) {
  await reloadBootstrapData();
  hideTripManager();
  const target = tripPath(trip.slug);
  if (!navigate(target, { replace: true })) await applyRoute(currentRoute());
}

async function handleTripDeleted() {
  await reloadBootstrapData();
  hideTripManager();
  if (!navigate('/', { replace: true })) await applyRoute(currentRoute());
}

async function applyRoute(route) {
  hideTripSettings();
  hideTripParticipants();
  if (!state.currentProfile) return;
  if (state.currentProfile.mustChangePassword) return;

  if (route.name === 'trip-participants') {
    hideTripManager();
    if (state.privateModal) state.privateModal.hide();
    if (state.userManagerModal) state.userManagerModal.hide();

    const access = state.accessibleTrips.find((item) => item.trip?.slug === route.slug);
    if (!access || !(access.permissions || []).includes('members.manage')) {
      refreshTripPicker();
      showTripPicker();
      setStatus($('tripGateStatus'), 'No tenés permiso para gestionar los participantes de este viaje.', 'error');
      return;
    }

    clearTripUi();
    $('authGate').classList.add('hidden');
    hideTripPicker();
    showTripParticipants(access.trip);
    return;
  }

  if (route.name === 'trip-settings') {
    hideTripManager();
    if (state.privateModal) state.privateModal.hide();
    if (state.userManagerModal) state.userManagerModal.hide();
    const access = state.accessibleTrips.find((item) => item.trip?.slug === route.slug);
    if (!access || !(access.permissions || []).includes('trip.edit')) {
      refreshTripPicker();
      showTripPicker();
      setStatus($('tripGateStatus'), 'No tenés permiso para configurar este viaje.', 'error');
      return;
    }
    const requestingUser = state.currentUser;
    const isCurrent = () => state.currentProfile && state.currentUser === requestingUser && currentRoute().path === route.path;
    showTripPicker();
    setStatus($('tripGateStatus'), 'Cargando configuración…');
    try {
      const result = await tripApi('trip-detail', { slug: route.slug });
      if (!isCurrent()) return;
      if (!(result.permissions || []).includes('trip.edit')) {
        setStatus($('tripGateStatus'), 'No tenés permiso para configurar este viaje.', 'error');
        return;
      }
      hideTripPicker();
      showTripSettings(access.trip, result.settings);
    } catch (error) {
      if (isCurrent() && error.message !== 'SESSION_EXPIRED') {
        setStatus($('tripGateStatus'), error.message || 'No se pudo cargar la configuración.', 'error');
      }
    }
    return;
  }

  if (route.name === 'not-found') {
    navigate('/', { replace: true });
    return;
  }

  if (route.name === 'users') {
    if (!state.currentProfile.systemOwner) {
      navigate('/', { replace: true });
      return;
    }

    hideTripManager();
    if (state.privateModal) state.privateModal.hide();
    refreshTripPicker();
    showTripPicker();
    await openUserManager();
    return;
  }

  if (route.name === 'trip-new' || route.name === 'trip-edit') {
    if (!state.currentProfile.systemOwner) {
      navigate('/', { replace: true });
      return;
    }

    if (state.privateModal) state.privateModal.hide();
    if (state.userManagerModal) state.userManagerModal.hide();
    clearTripUi();
    $('authGate').classList.add('hidden');
    hideTripPicker();

    if (route.name === 'trip-new') {
      showTripManager();
      return;
    }

    const access = state.accessibleTrips.find((item) => item.trip?.slug === route.slug);
    if (!access?.trip) {
      navigate('/', { replace: true });
      return;
    }

    try {
      const managementData = await tripApi('trip-manage-detail', { slug: access.trip.slug });
      showTripManager(managementData);
    } catch (error) {
      if (error.message === 'SESSION_EXPIRED') return;
      navigate('/', { replace: true });
      refreshTripPicker();
      showTripPicker();
      setStatus($('tripGateStatus'), error.message || 'No se pudo cargar el viaje para editar.', 'error');
    }
    return;
  }

  hideTripManager();
  if (state.userManagerModal) state.userManagerModal.hide();

  if (route.name === 'trip') {
    const access = state.accessibleTrips.find((item) => item.trip?.slug === route.slug);
    if (!access) {
      refreshTripPicker();
      showTripPicker();
      setStatus($('tripGateStatus'), 'No tenés acceso al viaje solicitado.', 'error');
      return;
    }

    await openTrip(access);
    return;
  }

  if (state.privateModal) state.privateModal.hide();
  refreshTripPicker();
  showTripPicker();
}

async function logout() {
  hideTripSettings();
  hideTripParticipants();
  if (state.privateModal) state.privateModal.hide();
  if (state.userManagerModal) state.userManagerModal.hide();
  hideTripManager();

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
  bindTripManager({
    onNew: () => navigate('/trips/new'),
    onCancel: () => navigate('/'),
    onSaved: handleTripSaved,
    onDeleted: handleTripDeleted,
  });
  bindTripSettings({
    onCancel: (trip) => navigate(tripPath(trip.slug)),
    onSaved: (trip) => navigate(tripPath(trip.slug), { replace: true }),
    onLogout: logout,
  });
  bindTripParticipants({
    onBack: (trip) => navigate(tripPath(trip.slug)),
    onLogout: logout,
  });
  bindUserManager({ onOpen: () => navigate('/users') });
  bindNavigation();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await authorize(session.user);
  else {
    purgePrivateSessionData();
    showLogin();
  }
});
