import { $, setStatus } from '../shared/dom.js';
import { formatDestination } from '../shared/geography.js';

function displayName(profile) {
  return profile?.displayName?.trim() || profile?.email?.split('@')[0] || 'viajero';
}

export function renderTripPicker(profile, accessibleTrips, onOpenTrip, onEditTrip, onConfigureTrip, onManageParticipants) {
  $('tripGreeting').textContent = `Hola, ${displayName(profile)} 👋`;
  $('systemOwnerActions').classList.toggle('visible', profile?.systemOwner === true);
  $('tripList').replaceChildren();

  for (const access of accessibleTrips) {
    const trip = access.trip;
    if (!trip) continue;

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';

    const wrapper = document.createElement('div');
    wrapper.className = 'd-grid gap-2';

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
    badge.textContent = access.membership?.role?.name || (profile?.systemOwner ? 'System Owner' : 'Sin rol');
    top.append(name, badge);

    const destination = document.createElement('div');
    destination.className = 'trip-muted';
    destination.textContent = formatDestination(
      trip.destination,
      trip.countryCode || trip.country_code,
      trip.regionCode || trip.region_code,
    );
    const hint = document.createElement('div');
    hint.className = 'small mt-3';
    hint.textContent = 'Abrir viaje →';

    button.append(top, destination, hint);
    button.addEventListener('click', () => onOpenTrip(access));
    wrapper.append(button);

    const actions = document.createElement('div');
    actions.className = 'd-flex flex-wrap gap-2';

    if (profile?.systemOwner && onEditTrip) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-outline-light btn-sm flex-grow-1';
      edit.textContent = '✏️ Editar viaje';
      edit.addEventListener('click', () => onEditTrip(access));
      actions.append(edit);
    }

    if ((access.permissions || []).includes('trip.edit') && onConfigureTrip) {
      const configure = document.createElement('button');
      configure.type = 'button';
      configure.className = 'btn btn-outline-light btn-sm flex-grow-1';
      configure.textContent = '🎨 Apariencia';
      configure.addEventListener('click', () => onConfigureTrip(access));
      actions.append(configure);
    }

    if ((access.permissions || []).includes('members.manage') && onManageParticipants) {
      const participants = document.createElement('button');
      participants.type = 'button';
      participants.className = 'btn btn-outline-info btn-sm flex-grow-1';
      participants.textContent = '👥 Participantes';
      participants.addEventListener('click', () => onManageParticipants(access));
      actions.append(participants);
    }

    if (actions.childElementCount) wrapper.append(actions);

    col.append(wrapper);
    $('tripList').append(col);
  }

  setStatus(
    $('tripGateStatus'),
    accessibleTrips.length ? '' : 'No tenés viajes disponibles.',
    accessibleTrips.length ? '' : 'error',
  );
}
