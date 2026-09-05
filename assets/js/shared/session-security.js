import { $ } from './dom.js';
import { state } from '../state.js';

const EMPTY_SYSTEM_DATA = () => ({ users: [], trips: [], roles: [] });

function clearChildren(id) {
  $(id)?.replaceChildren();
}

function clearText(id) {
  const element = $(id);
  if (element) element.textContent = '';
}

function resetForm(id) {
  const form = $(id);
  if (form instanceof HTMLFormElement) form.reset();
}

export function purgePrivateSessionData() {
  clearInterval(state.countdownTimer);

  state.currentUser = null;
  state.currentProfile = null;
  state.tripMemberships = [];
  state.currentTrip = null;
  state.currentMembership = null;
  state.roles = [];
  state.countdownTimer = null;
  state.systemData = EMPTY_SYSTEM_DATA();
  state.editingUserId = null;

  clearChildren('tripShell');
  clearChildren('tripList');
  clearChildren('members');
  clearChildren('availableUsersList');
  clearChildren('tripMemberRole');
  clearChildren('systemUserList');
  clearChildren('systemUserAssignments');

  clearText('tripGreeting');
  clearText('privateTripTitle');
  clearText('userLine');
  clearText('tripGateStatus');
  clearText('tripMemberStatus');
  clearText('userManagerStatus');
  clearText('systemUserFormStatus');
  clearText('authStatus');

  const tripShell = $('tripShell');
  tripShell?.classList.remove('visible');
  tripShell?.setAttribute('aria-hidden', 'true');
  tripShell?.style.removeProperty('--trip-background-image');

  $('adminPanel')?.classList.remove('visible');
  $('systemOwnerActions')?.classList.remove('visible');

  resetForm('loginForm');
  resetForm('changePasswordForm');
  resetForm('tripMemberForm');
  resetForm('systemUserForm');

  const userFormTitle = $('systemUserFormTitle');
  if (userFormTitle) userFormTitle.textContent = 'Agregar usuario';

  $('systemUserPasswordGroup')?.classList.remove('d-none');
  const systemUserPassword = $('systemUserPassword');
  if (systemUserPassword) systemUserPassword.required = true;

  const systemUserEnabled = $('systemUserEnabled');
  if (systemUserEnabled) {
    systemUserEnabled.checked = true;
    systemUserEnabled.disabled = false;
  }
}
