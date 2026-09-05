import { $, setStatus } from '../shared/dom.js';

function displayName(profile) {
  return profile?.displayName?.trim() || profile?.email?.split('@')[0] || 'viajero';
}

export function renderTripPicker(profile, memberships, onOpenTrip) {
  $('tripGreeting').textContent = `Hola, ${displayName(profile)} 👋`;
  $('systemOwnerActions').classList.toggle('visible', profile?.systemOwner === true);
  $('tripList').replaceChildren();

  for (const membership of memberships) {
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
    button.addEventListener('click', () => onOpenTrip(membership));
    col.append(button);
    $('tripList').append(col);
  }

  setStatus(
    $('tripGateStatus'),
    memberships.length ? '' : 'No tenés viajes asignados.',
    memberships.length ? '' : 'error',
  );
}
