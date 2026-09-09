import type { Trip } from './trip';

export function formatTripDestination(trip: Trip) {
  const parts = [trip.destination?.trim(), trip.regionCode?.trim()].filter(Boolean) as string[];

  if (trip.countryCode) {
    try {
      const country = new Intl.DisplayNames(['es-AR'], { type: 'region' }).of(trip.countryCode.toUpperCase());
      if (country) parts.push(country);
    } catch {
      parts.push(trip.countryCode.toUpperCase());
    }
  }

  return parts.length ? parts.join(', ') : 'Destino por definir';
}

export function formatTripDate(value?: string | null) {
  if (!value) return 'Sin definir';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
