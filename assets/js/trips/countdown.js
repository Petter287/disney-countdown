import { $ } from '../shared/dom.js';
import { state } from '../state.js';

export function stopCountdown() {
  clearInterval(state.countdownTimer);
  state.countdownTimer = null;
}

export function startCountdown(settings) {
  const start = new Date(settings.startAt);
  const target = new Date(settings.defaultArrivalAt);
  const timeZone = settings.defaultTimezone || 'UTC';

  stopCountdown();
  $('datePill').textContent = formatTripStartDate(target, timeZone);

  const tick = () => {
    const now = new Date();
    const remaining = target - now;
    const diff = Math.max(0, remaining);
    const days = Math.floor(diff / 864e5);

    $('days').textContent = String(days).padStart(3, '0');
    $('hours').textContent = String(Math.floor(diff / 36e5) % 24).padStart(2, '0');
    $('minutes').textContent = String(Math.floor(diff / 6e4) % 60).padStart(2, '0');
    $('seconds').textContent = String(Math.floor(diff / 1e3) % 60).padStart(2, '0');

    const denominator = target - start;
    const percent = denominator > 0
      ? Math.min(100, Math.max(0, ((now - start) / denominator) * 100))
      : 100;

    $('progressBar').style.width = `${percent}%`;
    $('progressText').textContent = `${percent.toFixed(1)}%`;
    $('targetInfo').textContent = remaining > 0
      ? `Faltan ${days} ${days === 1 ? 'día' : 'días'} para el comienzo del viaje.`
      : 'El viaje ya comenzó.';
  };

  tick();
  state.countdownTimer = setInterval(tick, 1000);
}

function formatTripStartDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone,
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return `📅 ${value('day')} · ${value('month').replace('.', '').toUpperCase()} · ${value('year')}`;
}
