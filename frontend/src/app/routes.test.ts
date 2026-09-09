import { describe, expect, it } from 'vitest';
import { appRoutes } from './routes';

describe('appRoutes', () => {
  it('keeps trip routes safe for hash routing', () => {
    expect(appRoutes.trip('orlando-2027')).toBe('/trips/orlando-2027');
    expect(appRoutes.tripSettings('viaje con espacios')).toBe('/trips/viaje%20con%20espacios/settings');
    expect(appRoutes.tripParticipants('argentina-2026')).toBe('/trips/argentina-2026/participants');
    expect(appRoutes.tripNew).toBe('/trips/new');
  });
});
