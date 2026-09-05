import { tripApi } from '../api.js';
import { $, setStatus } from '../shared/dom.js';

let activeTrip = null;
let onSaved = null;
let onDeleted = null;
let onCancel = null;
let onNew = null;

function ensureUi() {
  if (!$('newTripButton')) {
    const button = document.createElement('button');
    button.id = 'newTripButton';
    button.type = 'button';
    button.className = 'btn btn-outline-info btn-sm me-2';
    button.textContent = '+ Nuevo viaje';
    $('systemOwnerActions')?.prepend(button);
  }

  if ($('tripManagerGate')) return;

  const gate = document.createElement('div');
  gate.id = 'tripManagerGate';
  gate.className = 'trip-gate';
  gate.setAttribute('aria-hidden', 'true');
  gate.innerHTML = `
    <section class="glass-panel trip-picker p-4 p-md-5">
      <div class="d-flex justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div class="fs-2">🧳</div>
          <h1 id="tripCrudTitle" class="h3 fw-bold mb-1">Nuevo viaje</h1>
          <p id="tripCrudIntro" class="trip-muted mb-0"></p>
        </div>
        <button id="tripCrudCancel" type="button" class="btn btn-outline-light btn-sm">Volver</button>
      </div>
      <form id="tripCrudForm" autocomplete="off">
        <div class="row g-3">
          <div class="col-md-6">
            <label for="tripCrudName" class="form-label">Nombre</label>
            <input id="tripCrudName" class="form-control" maxlength="120" required>
          </div>
          <div class="col-md-6">
            <label for="tripCrudSlug" class="form-label">Slug</label>
            <input id="tripCrudSlug" class="form-control" maxlength="120" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required>
            <div class="form-text text-light opacity-75">Ejemplo: orlando-2027</div>
          </div>
          <div class="col-12">
            <label for="tripCrudDestination" class="form-label">Destino</label>
            <input id="tripCrudDestination" class="form-control" maxlength="160" required>
          </div>
          <div class="col-md-6">
            <label for="tripCrudStartsOn" class="form-label">Fecha de inicio</label>
            <input id="tripCrudStartsOn" class="form-control" type="date" required>
          </div>
          <div class="col-md-6">
            <label for="tripCrudEndsOn" class="form-label">Fecha de fin</label>
            <input id="tripCrudEndsOn" class="form-control" type="date">
          </div>
        </div>
        <div id="tripCrudStatus" class="small mt-3 trip-muted" aria-live="polite"></div>
        <div class="d-flex flex-column flex-sm-row gap-2 mt-4">
          <button id="tripCrudSave" class="btn btn-trip flex-fill" type="submit">Guardar viaje</button>
          <button id="tripCrudDelete" class="btn btn-outline-danger flex-fill d-none" type="button">Eliminar viaje</button>
        </div>
      </form>
    </section>`;

  document.body.insertBefore(gate, $('tripShell'));
}

function normalizeSlug(value) {
  return value.trim().toLowerCase();
}

function setBusy(isBusy) {
  $('tripCrudSave').disabled = isBusy;
  $('tripCrudDelete').disabled = isBusy;
  $('tripCrudCancel').disabled = isBusy;
}

export function hideTripManager() {
  const gate = $('tripManagerGate');
  if (!gate) return;
  gate.classList.remove('visible');
  gate.setAttribute('aria-hidden', 'true');
}

export function showTripManager(trip = null) {
  ensureUi();
  activeTrip = trip;
  const editing = Boolean(trip);

  $('tripCrudForm').reset();
  $('tripCrudTitle').textContent = editing ? 'Editar viaje' : 'Nuevo viaje';
  $('tripCrudIntro').textContent = editing
    ? 'Actualizá los datos generales del viaje.'
    : 'Creá el viaje. Después vas a poder personalizar su cuenta regresiva y configuración.';

  $('tripCrudSlug').value = trip?.slug || '';
  $('tripCrudName').value = trip?.name || '';
  $('tripCrudDestination').value = trip?.destination || '';
  $('tripCrudStartsOn').value = trip?.starts_on || '';
  $('tripCrudEndsOn').value = trip?.ends_on || '';
  $('tripCrudDelete').classList.toggle('d-none', !editing);
  setStatus($('tripCrudStatus'));

  $('tripManagerGate').classList.add('visible');
  $('tripManagerGate').setAttribute('aria-hidden', 'false');
}

export function bindTripManager(callbacks = {}) {
  ensureUi();
  onSaved = callbacks.onSaved || null;
  onDeleted = callbacks.onDeleted || null;
  onCancel = callbacks.onCancel || null;
  onNew = callbacks.onNew || null;

  $('newTripButton').addEventListener('click', () => onNew?.());
  $('tripCrudCancel').addEventListener('click', () => onCancel?.());

  $('tripCrudForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const slug = normalizeSlug($('tripCrudSlug').value);
    const name = $('tripCrudName').value.trim();
    const destination = $('tripCrudDestination').value.trim();
    const startsOn = $('tripCrudStartsOn').value;
    const endsOn = $('tripCrudEndsOn').value || null;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return setStatus($('tripCrudStatus'), 'El slug solo puede usar minúsculas, números y guiones.', 'error');
    }
    if (!name || !destination || !startsOn) {
      return setStatus($('tripCrudStatus'), 'Completá nombre, destino y fecha de inicio.', 'error');
    }
    if (endsOn && endsOn < startsOn) {
      return setStatus($('tripCrudStatus'), 'La fecha de fin no puede ser anterior al inicio.', 'error');
    }

    setBusy(true);
    setStatus($('tripCrudStatus'), activeTrip ? 'Guardando cambios…' : 'Creando viaje…');
    try {
      const payload = { slug, name, destination, startsOn, endsOn };
      const result = activeTrip
        ? await tripApi('trip-update', { ...payload, currentSlug: activeTrip.slug })
        : await tripApi('trip-create', payload);
      await onSaved?.(result.trip);
    } catch (error) {
      setStatus($('tripCrudStatus'), error.message || 'No se pudo guardar el viaje.', 'error');
    } finally {
      setBusy(false);
    }
  });

  $('tripCrudDelete').addEventListener('click', async () => {
    if (!activeTrip) return;
    if (!window.confirm(`¿Eliminar "${activeTrip.name}"? Esta acción también elimina su configuración y participantes.`)) return;

    setBusy(true);
    setStatus($('tripCrudStatus'), 'Eliminando viaje…');
    try {
      await tripApi('trip-delete', { slug: activeTrip.slug });
      await onDeleted?.(activeTrip);
    } catch (error) {
      setStatus($('tripCrudStatus'), error.message || 'No se pudo eliminar el viaje.', 'error');
    } finally {
      setBusy(false);
    }
  });
}
