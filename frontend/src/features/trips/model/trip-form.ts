import { COUNTRY_CODES } from '../../../shared/geography/geography';
import type { Trip, TripMutationInput } from './trip';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REGION_RE = /^[A-Za-z0-9-]{1,12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_CODE_SET = new Set(COUNTRY_CODES);

export interface TripFormState {
  name: string;
  slug: string;
  countryCode: string;
  regionCode: string;
  destination: string;
  startsOn: string;
  endsOn: string;
}

export type TripFormField = keyof TripFormState;

export interface TripFormErrors {
  fields: Partial<Record<TripFormField, string>>;
  form?: string;
}

export function emptyTripForm(): TripFormState {
  return {
    name: '',
    slug: '',
    countryCode: '',
    regionCode: '',
    destination: '',
    startsOn: '',
    endsOn: '',
  };
}

export function tripToForm(trip: Trip): TripFormState {
  return {
    name: trip.name || '',
    slug: trip.slug || '',
    countryCode: trip.countryCode || '',
    regionCode: trip.regionCode || '',
    destination: trip.destination || '',
    startsOn: trip.startsOn || '',
    endsOn: trip.endsOn || '',
  };
}

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export function isValidDateOnly(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function buildTripInput(form: TripFormState, defaultTimezone: string): {
  input?: TripMutationInput;
  errors: TripFormErrors;
} {
  const name = form.name.trim();
  const slug = normalizeSlug(form.slug);
  const countryCode = form.countryCode.trim().toUpperCase();
  const regionCode = form.regionCode.trim();
  const destination = form.destination.trim();
  const startsOn = form.startsOn.trim();
  const endsOn = form.endsOn.trim();
  const timezone = defaultTimezone.trim();
  const fields: TripFormErrors['fields'] = {};

  if (!name) fields.name = 'Ingresá un nombre para el viaje.';
  else if (name.length > 120) fields.name = 'El nombre no puede superar los 120 caracteres.';

  if (!SLUG_RE.test(slug) || slug.length > 120) {
    fields.slug = 'Usá minúsculas, números y guiones; por ejemplo orlando-2027.';
  }

  if (!COUNTRY_CODE_SET.has(countryCode)) fields.countryCode = 'Seleccioná un país válido.';
  if (regionCode && !REGION_RE.test(regionCode)) fields.regionCode = 'La provincia o estado seleccionado no es válido.';
  if (destination.length > 160) fields.destination = 'La ciudad no puede superar los 160 caracteres.';
  if (!isValidDateOnly(startsOn)) fields.startsOn = 'Ingresá una fecha de inicio válida.';
  if (endsOn && (!isValidDateOnly(endsOn) || (isValidDateOnly(startsOn) && endsOn < startsOn))) {
    fields.endsOn = 'La fecha de fin no puede ser anterior al inicio.';
  }

  const errors: TripFormErrors = { fields };
  if (!timezone || timezone.length > 100) {
    errors.form = 'No se pudo determinar automáticamente la hora local del destino.';
  }

  if (Object.keys(fields).length || errors.form) return { errors };

  return {
    errors,
    input: {
      name,
      slug,
      countryCode,
      regionCode: regionCode || null,
      destination,
      startsOn,
      endsOn: endsOn || null,
      defaultTimezone: timezone,
    },
  };
}
