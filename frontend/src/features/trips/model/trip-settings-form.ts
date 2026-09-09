export interface TripSettingsFormValues {
  eyebrow: string;
  title: string;
  subtitle: string;
  photoCredit: string;
}

export const TRIP_SETTINGS_LIMITS = {
  eyebrow: 160,
  title: 200,
  subtitle: 500,
  photoCredit: 300,
} as const;

export function normalizeTripSettingsForm(values: TripSettingsFormValues): TripSettingsFormValues {
  return {
    eyebrow: values.eyebrow.trim(),
    title: values.title.trim(),
    subtitle: values.subtitle.trim(),
    photoCredit: values.photoCredit.trim(),
  };
}

export function validateTripSettingsForm(values: TripSettingsFormValues) {
  const normalized = normalizeTripSettingsForm(values);
  if (!normalized.title) return { error: 'Ingresá un título.', value: null } as const;

  for (const [field, limit] of Object.entries(TRIP_SETTINGS_LIMITS) as [keyof TripSettingsFormValues, number][]) {
    if (normalized[field].length > limit) {
      return { error: `El campo ${field} supera los ${limit} caracteres permitidos.`, value: null } as const;
    }
  }

  return { error: null, value: normalized } as const;
}
