import { Country, State } from 'https://cdn.jsdelivr.net/npm/country-state-city@3.2.1/+esm';
import tzlookup from 'https://cdn.jsdelivr.net/npm/tz-lookup@6.1.25/+esm';

export const COUNTRY_CODES = Country.getAllCountries().map((country) => country.isoCode);

const countryNames = new Intl.DisplayNames(['es'], { type: 'region' });

export function countryName(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!COUNTRY_CODES.includes(normalized)) return normalized;
  return countryNames.of(normalized) || normalized;
}

export function countryOptions() {
  return Country.getAllCountries()
    .map((country) => ({ code: country.isoCode, name: countryName(country.isoCode) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function regionOptions(countryCode) {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!normalized) return [];
  return State.getStatesOfCountry(normalized)
    .map((state) => ({ code: state.isoCode, name: state.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function regionName(countryCode, regionCode) {
  const country = String(countryCode || '').trim().toUpperCase();
  const region = String(regionCode || '').trim();
  if (!country || !region) return '';
  return State.getStateByCodeAndCountry(region, country)?.name || region;
}

function coordinatesFor(countryCode, regionCode = '') {
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

export function inferTimezone(countryCode, regionCode = '') {
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

export function formatDestination(city, countryCode, regionCode = '') {
  const parts = [];
  const place = String(city || '').trim();
  const region = regionName(countryCode, regionCode);
  const country = countryName(countryCode);

  if (place) parts.push(place);
  if (region && region !== place) parts.push(region);
  if (country) parts.push(country);
  return parts.join(' · ');
}
