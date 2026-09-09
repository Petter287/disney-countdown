import { describe, expect, it } from 'vitest';
import { normalizeTripSettingsForm, validateTripSettingsForm } from './trip-settings-form';

describe('trip settings form', () => {
  it('trims texts before sending them to the backend', () => {
    expect(normalizeTripSettingsForm({
      eyebrow: '  Próximo viaje  ',
      title: '  Orlando 2027  ',
      subtitle: '  Falta menos  ',
      photoCredit: '  Foto de Lucas  ',
    })).toEqual({
      eyebrow: 'Próximo viaje',
      title: 'Orlando 2027',
      subtitle: 'Falta menos',
      photoCredit: 'Foto de Lucas',
    });
  });

  it('requires a non-empty title', () => {
    const result = validateTripSettingsForm({ eyebrow: '', title: '   ', subtitle: '', photoCredit: '' });
    expect(result.error).toBe('Ingresá un título.');
    expect(result.value).toBeNull();
  });

  it('rejects texts beyond backend limits', () => {
    const result = validateTripSettingsForm({
      eyebrow: '',
      title: 'x'.repeat(201),
      subtitle: '',
      photoCredit: '',
    });
    expect(result.error).toContain('200');
  });
});
