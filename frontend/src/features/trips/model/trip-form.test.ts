import { describe, expect, it } from 'vitest';
import { buildTripInput, emptyTripForm, isValidDateOnly, normalizeSlug } from './trip-form';

describe('trip form', () => {
  it('normalizes slugs without allowing spaces or uppercase letters', () => {
    expect(normalizeSlug('  Orlando Enero 2027  ')).toBe('orlando-enero-2027');
  });

  it('validates calendar dates instead of accepting normalized invalid dates', () => {
    expect(isValidDateOnly('2028-02-29')).toBe(true);
    expect(isValidDateOnly('2027-02-29')).toBe(false);
    expect(isValidDateOnly('2027-13-01')).toBe(false);
  });

  it('builds the backend payload with normalized optional fields', () => {
    const result = buildTripInput({
      ...emptyTripForm(),
      name: ' Orlando 2027 ',
      slug: 'Orlando 2027',
      countryCode: 'us',
      regionCode: 'FL',
      destination: ' Orlando ',
      startsOn: '2027-01-10',
      endsOn: '2027-01-20',
    }, 'America/New_York');

    expect(result.errors).toEqual({ fields: {} });
    expect(result.input).toMatchObject({
      name: 'Orlando 2027',
      slug: 'orlando-2027',
      countryCode: 'US',
      regionCode: 'FL',
      destination: 'Orlando',
      defaultTimezone: 'America/New_York',
    });
  });

  it('rejects inverted date ranges and missing timezones', () => {
    const result = buildTripInput({
      ...emptyTripForm(),
      name: 'Prueba',
      slug: 'prueba',
      countryCode: 'AR',
      startsOn: '2027-05-20',
      endsOn: '2027-05-10',
    }, '');

    expect(result.input).toBeUndefined();
    expect(result.errors.fields.endsOn).toBeTruthy();
    expect(result.errors.form).toBeTruthy();
  });
});
