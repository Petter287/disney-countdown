import { $ } from '../shared/dom.js';

export function renderTripShell(settings, { onOpenDetails, onChangeTrip }) {
  const shell = $('tripShell');
  shell.innerHTML = `
    <button id="openTripDetails" class="btn btn-dark position-fixed top-0 end-0 m-3 rounded-pill z-3" type="button">✨ Mi viaje</button>
    <button id="quickChangeTrip" class="btn btn-dark position-fixed top-0 start-0 m-3 rounded-pill z-3" type="button">🌎 Mis viajes</button>
    <main class="container min-vh-100 d-flex align-items-center justify-content-center py-3">
      <section class="countdown-card w-100 p-4 text-center">
        <div id="tripEyebrow" class="eyebrow mb-2"></div>
        <h1 id="tripTitle" class="trip-title fw-bold mb-2"></h1>
        <p id="tripSubtitle" class="trip-muted mb-3"></p>
        <span id="datePill" class="badge rounded-pill date-pill px-3 py-2"></span>
        <div class="row g-2 my-3">
          <div class="col-6 col-md-3"><div class="count-unit d-flex flex-column justify-content-center"><div id="days" class="count-number">000</div><div class="count-label">Días</div></div></div>
          <div class="col-6 col-md-3"><div class="count-unit d-flex flex-column justify-content-center"><div id="hours" class="count-number">00</div><div class="count-label">Horas</div></div></div>
          <div class="col-6 col-md-3"><div class="count-unit d-flex flex-column justify-content-center"><div id="minutes" class="count-number">00</div><div class="count-label">Minutos</div></div></div>
          <div class="col-6 col-md-3"><div class="count-unit d-flex flex-column justify-content-center"><div id="seconds" class="count-number">00</div><div class="count-label">Segundos</div></div></div>
        </div>
        <div class="d-flex justify-content-between small trip-muted mb-2"><span>Cuenta regresiva iniciada</span><span id="progressText">Calculando…</span></div>
        <div class="progress rounded-pill"><div id="progressBar" class="progress-bar"></div></div>
        <p id="targetInfo" class="small trip-muted mt-3 mb-1">Calculando fecha…</p>
        <p id="photoCredit" class="photo-credit mb-0"></p>
      </section>
    </main>`;

  $('tripEyebrow').textContent = settings.eyebrow;
  $('tripTitle').textContent = settings.title;
  $('tripSubtitle').textContent = settings.subtitle;
  $('photoCredit').textContent = settings.photoCredit || '';

  if (settings.backgroundUrl) {
    try {
      const url = new URL(settings.backgroundUrl);
      if (url.protocol === 'https:') shell.style.setProperty('--trip-background-image', `url("${url.href}")`);
    } catch {
      // Keep the CSS fallback image.
    }
  }

  $('openTripDetails').addEventListener('click', onOpenDetails);
  $('quickChangeTrip').addEventListener('click', onChangeTrip);
  shell.setAttribute('aria-hidden', 'false');
}
