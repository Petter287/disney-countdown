import { tripApi } from '../api.js';
import { $, setStatus } from '../shared/dom.js';

let activeTrip = null;
let onSaved = null;
let onDeleted = null;
let onCancel = null;

function normalizeSlug(value) {
  return value.trim().toLowerCase();
}

function setBusy(isBusy) {
  $('tripCrudSave').disabled = isBusy;
  $('tripCrudDelete').disabled = isBusy;
  $('tripCrudCancel').disabled = isBusy;
}

export function hideTripManager() {
  $('tripManagerGate').classList.remove('visible');
  $('tripManagerGate').setAttribute('aria-hidden', 'true');
}

export function showTripManager(trip = null) {
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
  onSaved = callbacks.onSaved || null;
  onDeleted = callbacks.onDeleted || null;
  onCancel = callbacks.onCancel || null;

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
