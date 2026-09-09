import { Country, State } from 'country-state-city';
import tzlookup from 'tz-lookup';

export const COUNTRY_CODES = Country.getAllCountries().map((country) => country.isoCode);
const COUNTRY_CODE_SET = new Set(COUNTRY_CODES);
const countryNames = new Intl.DisplayNames(['es-AR', 'es'], { type: 'region' });

export function countryName(code: string) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!COUNTRY_CODE_SET.has(normalized)) return normalized;
  return countryNames.of(normalized) || normalized;
}

export function countryOptions() {
  return Country.getAllCountries()
    .map((country) => ({ code: country.isoCode, name: countryName(country.isoCode) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function regionOptions(countryCode: string) {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!normalized) return [];
  return State.getStatesOfCountry(normalized)
    .map((state) => ({ code: state.isoCode, name: state.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function coordinatesFor(countryCode: string, regionCode = '') {
  const country = String(countryCode || '').trim().toUpperCase();
  const region = String(regionCode || '').trim();

  if (country && region) {
    const state = State.getStateByCodeAndCountry(region, country);
    const latitude = Number(state?.latitude);
    const longitude = Number(state?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
  }

  const countryData = Country.getCountryByCode(country);
  const latitude = Number(countryData?.latitude);
  const longitude = Number(countryData?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
  return null;
}

export function inferTimezone(countryCode: string, regionCode = '') {
  const country = Country.getCountryByCode(String(countryCode || '').trim().toUpperCase());
  if (!country) return '';

  if (!regionCode && country.timezones?.length === 1 && country.timezones[0]?.zoneName) {
    return country.timezones[0].zoneName;
  }

  const coordinates = coordinatesFor(country.isoCode, regionCode);
  if (!coordinates) return country.timezones?.[0]?.zoneName || '';

  try {
    return tzlookup(coordinates.latitude, coordinates.longitude);
  } catch {
    return country.timezones?.[0]?.zoneName || '';
  }
}
