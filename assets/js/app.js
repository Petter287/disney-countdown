import { supabase, tripApi } from './api.js';
import { bindAuth } from './auth/auth.js';
import { $, setStatus } from './shared/dom.js';
import { state } from './state.js';
import { startCountdown, stopCountdown } from './trips/countdown.js';
import { bindTripAdminForm, loadTripAdminData } from './trips/trip-admin.js';
import { renderTripPicker } from './trips/trip-picker.js';
import { renderTripShell } from './trips/trip-view.js';
import { bindUserManager } from './users/user-manager.js';

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

function refreshTripPicker() {
  renderTripPicker(state.currentProfile, state.tripMemberships, openTrip);
}

async function authorize(user) {
  state.currentUser = user;
  try {
    const bootstrap = await tripApi('bootstrap');
    state.currentProfile = bootstrap.profile;
    state.tripMemberships = bootstrap.memberships || [];
  } catch (error) {
    await supabase.auth.signOut();
    state.currentUser = null;
    state.currentProfile = null;
    state.tripMemberships = [];
    showLogin(error.message || 'No se pudo validar tu acceso.', 'error');
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

  refreshTripPicker();
  showTripPicker();
}

async function openTrip(membership) {
  const trip = membership.trip;
  if (!trip) return;

  setStatus($('tripGateStatus'), 'Cargando viaje…');
  let settings;
  let permissions = membership.permissions || [];
  try {
    const result = await tripApi('trip-detail', { tripId: trip.id });
    settings = result.settings;
    permissions = result.permissions || permissions;
  } catch (error) {
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
  refreshTripPicker();
  showTripPicker();
}

async function logout() {
  if (state.privateModal) state.privateModal.hide();
  if (state.userManagerModal) state.userManagerModal.hide();
  clearTripUi();
  await supabase.auth.signOut();
  state.currentUser = null;
  state.currentProfile = null;
  state.tripMemberships = [];
  $('loginForm').reset();
  $('changePasswordForm').reset();
  showLogin();
}

function bindNavigation() {
  $('changeTripButton').addEventListener('click', changeTrip);
  $('logoutButton').addEventListener('click', logout);
  $('tripGateLogout').addEventListener('click', logout);
}

window.addEventListener('DOMContentLoaded', async () => {
  state.privateModal = new bootstrap.Modal($('privateModal'));
  state.userManagerModal = new bootstrap.Modal($('userManagerModal'));

  bindAuth({ authorize, showLogin });
  bindTripAdminForm();
  bindUserManager();
  bindNavigation();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await authorize(session.user);
  else showLogin();
});
