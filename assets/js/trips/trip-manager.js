import { tripApi } from '../api.js';
import { $, setStatus } from '../shared/dom.js';
import { COUNTRY_CODES, countryOptions, inferTimezone, regionOptions } from '../shared/geography.js';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
      <form id="tripCrudForm" autocomplete="off" novalidate>
        <div class="row g-3">
          <div class="col-md-6">
            <label for="tripCrudName" class="form-label">Nombre</label>
            <input id="tripCrudName" class="form-control" maxlength="120" required>
            <div class="invalid-feedback">Ingresá un nombre para el viaje.</div>
          </div>
          <div class="col-md-6">
            <label for="tripCrudSlug" class="form-label">Slug</label>
            <input id="tripCrudSlug" class="form-control" maxlength="120" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required autocapitalize="none" spellcheck="false">
            <div class="form-text text-light opacity-75">Solo minúsculas, números y guiones. Ejemplo: orlando-2027</div>
            <div class="invalid-feedback">Usá un slug válido, por ejemplo orlando-2027.</div>
          </div>

          <div class="col-md-6">
            <label for="tripCrudCountry" class="form-label">País</label>
            <select id="tripCrudCountry" class="form-select" required>
              <option value="">Seleccioná un país</option>
            </select>
            <div class="invalid-feedback">Seleccioná un país válido.</div>
          </div>
          <div class="col-md-6">
            <label for="tripCrudRegion" class="form-label">Provincia / estado <span class="trip-muted fw-normal">(opcional)</span></label>
            <select id="tripCrudRegion" class="form-select" disabled>
              <option value="">Primero seleccioná un país</option>
            </select>
            <div class="form-text text-light opacity-75">Ayuda a ajustar automáticamente la hora local del destino.</div>
          </div>

          <div class="col-12">
            <label for="tripCrudDestination" class="form-label">Ciudad <span class="trip-muted fw-normal">(opcional)</span></label>
            <input id="tripCrudDestination" class="form-control" maxlength="160" placeholder="Ej. Orlando">
          </div>

          <div class="col-md-6">
            <label for="tripCrudStartsOn" class="form-label">Fecha de inicio</label>
            <input id="tripCrudStartsOn" class="form-control" type="date" required>
            <div class="invalid-feedback">Ingresá una fecha de inicio válida.</div>
          </div>
          <div class="col-md-6">
            <label for="tripCrudEndsOn" class="form-label">Fecha de fin</label>
            <input id="tripCrudEndsOn" class="form-control" type="date">
            <div class="invalid-feedback">La fecha de fin no puede ser anterior al inicio.</div>
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

  const countrySelect = $('tripCrudCountry');
  for (const country of countryOptions()) {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = country.name;
    countrySelect.append(option);
  }
}

function normalizeSlug(value) {
  return value.trim().toLowerCase();
}

function isValidDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function populateRegions(countryCode, selectedRegion = '') {
  const select = $('tripCrudRegion');
  select.replaceChildren();

  const regions = regionOptions(countryCode);
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = regions.length ? 'Sin provincia / estado' : 'No hay subdivisiones disponibles';
  select.append(empty);

  for (const region of regions) {
    const option = document.createElement('option');
    option.value = region.code;
    option.textContent = region.name;
    select.append(option);
  }

  select.disabled = !countryCode || !regions.length;
  select.value = regions.some((region) => region.code === selectedRegion) ? selectedRegion : '';
}

function setBusy(isBusy) {
  $('tripCrudSave').disabled = isBusy;
  $('tripCrudDelete').disabled = isBusy;
  $('tripCrudCancel').disabled = isBusy;
}

function setFieldValidity(element, valid, message = '') {
  element.setCustomValidity(valid ? '' : message);
}

function validateForm() {
  const form = $('tripCrudForm');
  const slug = normalizeSlug($('tripCrudSlug').value);
  const name = $('tripCrudName').value.trim();
  const countryCode = $('tripCrudCountry').value.trim().toUpperCase();
  const regionCode = $('tripCrudRegion').value.trim();
  const destination = $('tripCrudDestination').value.trim();
  const startsOn = $('tripCrudStartsOn').value;
  const endsOn = $('tripCrudEndsOn').value || null;
  const defaultTimezone = inferTimezone(countryCode, regionCode);

  $('tripCrudSlug').value = slug;
  setFieldValidity($('tripCrudName'), Boolean(name), 'Ingresá un nombre.');
  setFieldValidity($('tripCrudSlug'), SLUG_RE.test(slug), 'Slug inválido.');
  setFieldValidity($('tripCrudCountry'), COUNTRY_CODES.includes(countryCode), 'País inválido.');
  setFieldValidity($('tripCrudStartsOn'), isValidDateOnly(startsOn), 'Fecha inválida.');
  setFieldValidity($('tripCrudEndsOn'), !endsOn || (isValidDateOnly(endsOn) && endsOn >= startsOn), 'Rango de fechas inválido.');

  form.classList.add('was-validated');
  if (!form.checkValidity()) return { error: 'Revisá los campos marcados antes de guardar.' };
  if (!defaultTimezone) return { error: 'No se pudo determinar automáticamente la hora local del destino.' };

  return {
    value: {
      slug,
      name,
      destination,
      countryCode,
      regionCode: regionCode || null,
      defaultTimezone,
      startsOn,
      endsOn,
    },
  };
}

export function hideTripManager() {
  const gate = $('tripManagerGate');
  if (!gate) return;
  gate.classList.remove('visible');
  gate.setAttribute('aria-hidden', 'true');
}

export function showTripManager(data = null) {
  ensureUi();
  activeTrip = data?.trip || null;
  const editing = Boolean(activeTrip);

  const form = $('tripCrudForm');
  form.reset();
  form.classList.remove('was-validated');
  $('tripCrudTitle').textContent = editing ? 'Editar viaje' : 'Nuevo viaje';
  $('tripCrudIntro').textContent = editing
    ? 'Actualizá los datos generales, el destino y las fechas del viaje.'
    : 'Elegí el país y, si querés, la provincia/estado y ciudad. La hora local se calcula automáticamente.';

  $('tripCrudSlug').value = activeTrip?.slug || '';
  $('tripCrudName').value = activeTrip?.name || '';
  $('tripCrudCountry').value = activeTrip?.countryCode || '';
  populateRegions(activeTrip?.countryCode || '', activeTrip?.regionCode || '');
  $('tripCrudDestination').value = activeTrip?.destination || '';
  $('tripCrudStartsOn').value = activeTrip?.startsOn || '';
  $('tripCrudEndsOn').value = activeTrip?.endsOn || '';
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
  $('tripCrudSlug').addEventListener('input', (event) => {
    event.target.value = normalizeSlug(event.target.value.replace(/\s+/g, '-'));
  });
  $('tripCrudCountry').addEventListener('change', () => {
    populateRegions($('tripCrudCountry').value);
  });
  $('tripCrudForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const validation = validateForm();
    if (validation.error) return setStatus($('tripCrudStatus'), validation.error, 'error');

    setBusy(true);
    setStatus($('tripCrudStatus'), activeTrip ? 'Guardando cambios…' : 'Creando viaje…');
    try {
      const payload = validation.value;

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
    if (!window.confirm(`¿Eliminar "${activeTrip.name}"? Esta acción también elimina su configuración, participantes e imagen de fondo.`)) return;

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
