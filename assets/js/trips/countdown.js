import { $ } from '../shared/dom.js';
import { state } from '../state.js';

export function stopCountdown() {
  clearInterval(state.countdownTimer);
  state.countdownTimer = null;
}

export function startCountdown(settings) {
  const start = new Date(settings.startAt);
  const spainZones = new Set(['Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta']);

  const apply = (target, label, info) => {
    stopCountdown();
    $('datePill').textContent = label;
    $('targetInfo').textContent = info;

    const tick = () => {
      const now = new Date();
      const diff = Math.max(0, target - now);
      $('days').textContent = String(Math.floor(diff / 864e5)).padStart(3, '0');
      $('hours').textContent = String(Math.floor(diff / 36e5) % 24).padStart(2, '0');
      $('minutes').textContent = String(Math.floor(diff / 6e4) % 60).padStart(2, '0');
      $('seconds').textContent = String(Math.floor(diff / 1e3) % 60).padStart(2, '0');
      const denominator = target - start;
      const percent = denominator > 0 ? Math.min(100, Math.max(0, ((now - start) / denominator) * 100)) : 100;
      $('progressBar').style.width = `${percent}%`;
      $('progressText').textContent = `${percent.toFixed(1)}%`;
    };

    tick();
    state.countdownTimer = setInterval(tick, 1000);
  };

  const useDefault = () => {
    const target = new Date(settings.defaultArrivalAt);
    apply(target, formatArrivalDate(target, settings.defaultTimezone || 'UTC'), 'Fecha de llegada según el viaje seleccionado.');
  };

  const fallback = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (settings.spainArrivalAt && spainZones.has(tz)) {
      const canary = tz === 'Atlantic/Canary';
      const target = new Date(canary && settings.canaryArrivalAt ? settings.canaryArrivalAt : settings.spainArrivalAt);
      apply(
        target,
        formatArrivalDate(target, canary ? (settings.canaryTimezone || 'Atlantic/Canary') : (settings.spainTimezone || 'Europe/Madrid')),
        'Fecha ajustada a España · detección por zona horaria.',
      );
      return;
    }
    useDefault();
  };

  if (!settings.spainArrivalAt || !navigator.geolocation) return fallback();

  navigator.geolocation.getCurrentPosition(({ coords }) => {
    const { latitude, longitude } = coords;
    const boxes = [
      [35.7, 43.9, -9.6, 4.6],
      [38.5, 40.2, 1, 4.5],
      [27.5, 29.6, -18.3, -13.2],
      [35.7, 36, -5.5, -5.1],
      [35.1, 35.4, -3.1, -2.8],
    ];
    const inSpain = boxes.some(([south, north, west, east]) => latitude >= south && latitude <= north && longitude >= west && longitude <= east);
    if (!inSpain) return useDefault();

    const canary = latitude >= 27.5 && latitude <= 29.6 && longitude >= -18.3 && longitude <= -13.2;
    const target = new Date(canary && settings.canaryArrivalAt ? settings.canaryArrivalAt : settings.spainArrivalAt);
    apply(
      target,
      formatArrivalDate(target, canary ? (settings.canaryTimezone || 'Atlantic/Canary') : (settings.spainTimezone || 'Europe/Madrid')),
      'Fecha ajustada a España · detección por ubicación.',
    );
  }, fallback, { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 });
}

function formatArrivalDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone,
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return `🏰 ${value('day')} · ${value('month').replace('.', '').toUpperCase()} · ${value('year')}`;
}
