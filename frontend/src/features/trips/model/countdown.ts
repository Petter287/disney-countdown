export interface CountdownSnapshot {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  percent: number;
  started: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateCountdown(startAt: string, targetAt: string, nowMs = Date.now()): CountdownSnapshot {
  const startMs = Date.parse(startAt);
  const targetMs = Date.parse(targetAt);

  if (!Number.isFinite(startMs) || !Number.isFinite(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, percent: 0, started: false };
  }

  const remainingMs = Math.max(0, targetMs - nowMs);
  const days = Math.floor(remainingMs / 86_400_000);
  const hours = Math.floor(remainingMs / 3_600_000) % 24;
  const minutes = Math.floor(remainingMs / 60_000) % 60;
  const seconds = Math.floor(remainingMs / 1_000) % 60;
  const denominator = targetMs - startMs;
  const percent = denominator > 0
    ? clamp(((nowMs - startMs) / denominator) * 100, 0, 100)
    : 100;

  return {
    days,
    hours,
    minutes,
    seconds,
    percent,
    started: nowMs >= targetMs,
  };
}

export function formatTripStartDate(targetAt: string, timeZone: string) {
  const target = new Date(targetAt);
  if (Number.isNaN(target.getTime())) return 'Fecha no disponible';

  const format = (zone: string) => new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: zone,
  }).formatToParts(target);

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timeZone || 'UTC');
  } catch {
    parts = format('UTC');
  }

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `📅 ${value('day')} · ${value('month').replace('.', '').toUpperCase()} · ${value('year')}`;
}
