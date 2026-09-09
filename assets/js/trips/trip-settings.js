import { tripApi } from '../api.js';
import { $, setStatus } from '../shared/dom.js';
import { fileToBase64, validateImage } from '../shared/trip-images.js';

let active = null;
let previewUrl = null;
let generation = 0;
let busy = false;
let callbacks = {};

function ensureUi() {
  if ($('tripSettingsGate')) return;
  const gate = document.createElement('div');
  gate.id = 'tripSettingsGate';
  gate.className = 'trip-gate';
  gate.setAttribute('aria-hidden', 'true');
  gate.innerHTML = `
    <section class="glass-panel trip-picker p-4 p-md-5">
      <div class="d-flex flex-wrap justify-content-between gap-3 mb-4">
        <div><h1 id="tripSettingsHeading" class="h3 fw-bold" tabindex="-1">Configurar apariencia</h1>
          <p id="tripSettingsName" class="trip-muted mb-0"></p></div>
        <div class="d-flex align-items-start gap-2">
          <button id="tripSettingsBack" type="button" class="btn btn-outline-light btn-sm">Volver al viaje</button>
          <button id="tripSettingsLogout" type="button" class="btn btn-outline-light btn-sm">Cerrar sesión</button>
        </div>
      </div>
      <form id="tripSettingsForm" autocomplete="off" novalidate>
        <fieldset id="tripSettingsFields">
          <div class="mb-3"><label for="tripSettingsEyebrow" class="form-label">Encabezado <span class="trip-muted">(opcional)</span></label>
            <input id="tripSettingsEyebrow" class="form-control" maxlength="160" placeholder="Próxima parada: Orlando"></div>
          <div class="mb-3"><label for="tripSettingsTitle" class="form-label">Título</label>
            <input id="tripSettingsTitle" class="form-control" maxlength="200" required>
            <div class="invalid-feedback">Ingresá un título de hasta 200 caracteres.</div></div>
          <div class="mb-3"><label for="tripSettingsSubtitle" class="form-label">Subtítulo <span class="trip-muted">(opcional)</span></label>
            <textarea id="tripSettingsSubtitle" class="form-control" maxlength="500" rows="2"></textarea></div>
          <div class="mb-3"><label for="tripSettingsBackground" class="form-label">Imagen de fondo</label>
            <input id="tripSettingsBackground" class="visually-hidden" tabindex="-1" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="tripSettingsImageHint tripSettingsImageState">
            <div class="d-flex flex-wrap align-items-center gap-2">
              <button id="tripSettingsChooseBackground" type="button" class="btn btn-outline-light btn-sm">Elegir imagen</button>
              <span id="tripSettingsImageState" class="small trip-muted text-break" aria-live="polite"></span>
            </div>
            <img id="tripSettingsImageThumbnail" class="trip-background-preview mt-3 d-none" alt="Imagen de fondo actual">
            <div id="tripSettingsImageHint" class="form-text text-light opacity-75">JPG, PNG o WebP. Máximo 4 MB. Sin imagen se muestra un fondo neutro.</div>
            <div id="tripSettingsRemoveGroup" class="form-check mt-2 d-none">
              <input id="tripSettingsRemoveBackground" class="form-check-input" type="checkbox">
              <label for="tripSettingsRemoveBackground" class="form-check-label">Quitar la imagen actual</label>
            </div></div>
          <div class="mb-4"><label for="tripSettingsPhotoCredit" class="form-label">Crédito de la imagen <span class="trip-muted">(opcional)</span></label>
            <input id="tripSettingsPhotoCredit" class="form-control" maxlength="300" placeholder="Foto de…"></div>
        </fieldset>
        <h2 class="h6">Vista previa</h2>
        <div id="tripSettingsPreview" class="trip-settings-preview p-3 p-md-4">
          <div class="countdown-card p-3 text-center">
            <div id="tripSettingsPreviewEyebrow" class="eyebrow mb-2"></div>
            <h3 id="tripSettingsPreviewTitle" class="h2 fw-bold"></h3>
            <p id="tripSettingsPreviewSubtitle" class="trip-muted"></p>
            <span id="tripSettingsPreviewDate" class="badge rounded-pill date-pill px-3 py-2"></span>
            <p id="tripSettingsPreviewCredit" class="photo-credit mt-3 mb-0"></p>
          </div>
        </div>
        <p class="small trip-muted mt-2">La cuenta regresiva apunta al comienzo del viaje.</p>
        <div id="tripSettingsStatus" class="small mt-3 trip-muted" aria-live="polite"></div>
        <button id="tripSettingsSave" class="btn btn-trip w-100 mt-3" type="submit">Guardar configuración</button>
      </form>
    </section>`;
  document.body.insertBefore(gate, $('tripShell'));
}

function revokePreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function renderPreview() {
  for (const field of ['Eyebrow', 'Title', 'Subtitle', 'PhotoCredit']) {
    const id = field === 'PhotoCredit' ? 'Credit' : field;
    $(`tripSettingsPreview${id}`).textContent = $(`tripSettings${field}`).value.trim();
  }
  const preview = $('tripSettingsPreview');
  preview.style.removeProperty('--trip-background-image');
  const url = previewUrl || (!$('tripSettingsRemoveBackground').checked && active?.settings.backgroundUrl);
  const removing = $('tripSettingsRemoveBackground').checked;
  $('tripSettingsImageState').textContent = previewUrl
    ? `Nueva imagen: ${$('tripSettingsBackground').files?.[0]?.name || ''}`
    : removing ? 'La imagen se quitará al guardar.'
      : active?.settings.backgroundUrl ? 'Imagen actual guardada' : 'Sin imagen de fondo';
  $('tripSettingsChooseBackground').textContent = url ? 'Cambiar imagen' : 'Elegir imagen';
  const thumbnail = $('tripSettingsImageThumbnail');
  thumbnail.classList.add('d-none');
  thumbnail.removeAttribute('src');
  if (url) {
    try {
      const parsed = new URL(url);
      if (url === previewUrl || parsed.protocol === 'https:') {
        preview.style.setProperty('--trip-background-image', `url("${parsed.href}")`);
        thumbnail.src = parsed.href;
        thumbnail.alt = previewUrl ? 'Vista previa de la nueva imagen de fondo' : 'Imagen de fondo actual';
        thumbnail.classList.remove('d-none');
      }
    } catch { /* Keep the neutral background. */ }
  }
}

function setBusy(value) {
  busy = value;
  $('tripSettingsFields').disabled = value;
  $('tripSettingsSave').disabled = value;
  $('tripSettingsBack').disabled = value;
}

export function hideTripSettings() {
  generation += 1;
  active = null;
  revokePreview();
  const gate = $('tripSettingsGate');
  if (!gate) return;
  gate.classList.remove('visible');
  gate.setAttribute('aria-hidden', 'true');
  $('tripSettingsForm').reset();
  $('tripSettingsForm').classList.remove('was-validated');
  $('tripSettingsTitle').setCustomValidity('');
  $('tripSettingsPreview').style.removeProperty('--trip-background-image');
  $('tripSettingsImageThumbnail').removeAttribute('src');
  $('tripSettingsImageThumbnail').classList.add('d-none');
  $('tripSettingsImageState').textContent = '';
  $('tripSettingsChooseBackground').textContent = 'Elegir imagen';
  for (const id of ['Name', 'PreviewEyebrow', 'PreviewTitle', 'PreviewSubtitle', 'PreviewCredit', 'PreviewDate']) {
    $(`tripSettings${id}`).textContent = '';
  }
  $('tripSettingsRemoveGroup').classList.add('d-none');
  setStatus($('tripSettingsStatus'));
  setBusy(false);
}

export function showTripSettings(trip, settings) {
  ensureUi();
  hideTripSettings();
  active = { trip, settings };
  $('tripSettingsName').textContent = trip.name;
  for (const field of ['Eyebrow', 'Title', 'Subtitle', 'PhotoCredit']) {
    $(`tripSettings${field}`).value = settings[field[0].toLowerCase() + field.slice(1)] || '';
  }
  $('tripSettingsRemoveGroup').classList.toggle('d-none', !settings.backgroundUrl);
  const date = new Date(settings.defaultArrivalAt);
  $('tripSettingsPreviewDate').textContent = Number.isNaN(date.getTime()) ? '' : `📅 ${new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: settings.defaultTimezone,
  }).format(date)}`;
  renderPreview();
  $('tripSettingsGate').classList.add('visible');
  $('tripSettingsGate').setAttribute('aria-hidden', 'false');
  $('tripSettingsHeading').focus();
}

export function bindTripSettings(handlers = {}) {
  callbacks = handlers;
  ensureUi();
  $('tripSettingsBack').addEventListener('click', () => active && callbacks.onCancel?.(active.trip));
  $('tripSettingsLogout').addEventListener('click', () => callbacks.onLogout?.());
  $('tripSettingsChooseBackground').addEventListener('click', () => $('tripSettingsBackground').click());
  $('tripSettingsForm').addEventListener('input', renderPreview);
  $('tripSettingsTitle').addEventListener('input', () => $('tripSettingsTitle').setCustomValidity(''));
  $('tripSettingsBackground').addEventListener('change', () => {
    revokePreview();
    const file = $('tripSettingsBackground').files?.[0];
    const error = validateImage(file);
    if (error) $('tripSettingsBackground').value = '';
    else if (file) {
      previewUrl = URL.createObjectURL(file);
      $('tripSettingsRemoveBackground').checked = false;
    }
    setStatus($('tripSettingsStatus'), error || '', error ? 'error' : '');
    renderPreview();
  });
  $('tripSettingsRemoveBackground').addEventListener('change', () => {
    revokePreview();
    $('tripSettingsBackground').value = '';
    renderPreview();
  });
  $('tripSettingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!active || busy) return;
    const form = $('tripSettingsForm');
    $('tripSettingsTitle').setCustomValidity($('tripSettingsTitle').value.trim() ? '' : 'Ingresá un título.');
    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      form.reportValidity();
      return setStatus($('tripSettingsStatus'), 'Revisá los campos antes de guardar.', 'error');
    }
    const file = $('tripSettingsBackground').files?.[0];
    const imageError = validateImage(file);
    if (imageError) return setStatus($('tripSettingsStatus'), imageError, 'error');
    const requestGeneration = generation;
    const payload = { slug: active.trip.slug, updatedAt: active.settings.updatedAt,
      removeBackground: $('tripSettingsRemoveBackground').checked };
    for (const field of ['Eyebrow', 'Title', 'Subtitle', 'PhotoCredit']) {
      payload[field[0].toLowerCase() + field.slice(1)] = $(`tripSettings${field}`).value.trim();
    }
    setBusy(true);
    setStatus($('tripSettingsStatus'), 'Guardando configuración…');
    try {
      if (file) payload.backgroundImage = { contentBase64: await fileToBase64(file), contentType: file.type };
      if (requestGeneration !== generation) return;
      const result = await tripApi('trip-settings-update', payload);
      if (requestGeneration !== generation) return;
      await callbacks.onSaved?.(result.trip);
    } catch (error) {
      if (requestGeneration === generation) setStatus($('tripSettingsStatus'), error.message || 'No se pudo guardar la configuración.', 'error');
    } finally {
      if (requestGeneration === generation) setBusy(false);
    }
  });
}
