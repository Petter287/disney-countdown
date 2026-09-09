import { useMemo, useState, type FormEvent } from 'react';
import { countryOptions, inferTimezone, regionOptions } from '../../../shared/geography/geography';
import { buildTripInput, normalizeSlug, type TripFormErrors, type TripFormState } from '../model/trip-form';
import type { TripMutationInput } from '../model/trip';

interface TripEditorFormProps {
  title: string;
  intro: string;
  initial: TripFormState;
  initialTimezone?: string;
  busy: boolean;
  error?: string;
  submitLabel: string;
  onSubmit(input: TripMutationInput): Promise<void> | void;
  onCancel(): void;
  onDelete?: () => Promise<void> | void;
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="trip-field-error">{message}</span> : null;
}

export function TripEditorForm({
  title,
  intro,
  initial,
  initialTimezone = '',
  busy,
  error = '',
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: TripEditorFormProps) {
  const [form, setForm] = useState<TripFormState>(initial);
  const [validation, setValidation] = useState<TripFormErrors>({ fields: {} });
  const countries = useMemo(() => countryOptions(), []);
  const regions = useMemo(() => regionOptions(form.countryCode), [form.countryCode]);
  const inferredTimezone = useMemo(
    () => inferTimezone(form.countryCode, form.regionCode),
    [form.countryCode, form.regionCode],
  );
  const unchangedLocation = form.countryCode === initial.countryCode && form.regionCode === initial.regionCode;
  const timezone = inferredTimezone || (unchangedLocation ? initialTimezone : '');

  const update = (field: keyof TripFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidation((current) => ({
      ...current,
      fields: { ...current.fields, [field]: undefined },
      form: undefined,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = buildTripInput(form, timezone);
    setValidation(result.errors);
    if (!result.input) return;
    void onSubmit(result.input);
  };

  return (
    <section className="workspace-card trip-editor-card">
      <div className="trip-editor-heading">
        <div>
          <div className="trip-editor-icon">🧳</div>
          <div className="eyebrow">Administración del viaje</div>
          <h1>{title}</h1>
          <p className="lead">{intro}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Volver</button>
      </div>

      <form className="trip-editor-form" onSubmit={handleSubmit} noValidate>
        <div className="trip-form-grid">
          <label>
            <span>Nombre</span>
            <input
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              maxLength={120}
              autoComplete="off"
              disabled={busy}
            />
            <FieldError message={validation.fields.name} />
          </label>

          <label>
            <span>Slug</span>
            <input
              value={form.slug}
              onChange={(event) => update('slug', normalizeSlug(event.target.value))}
              maxLength={120}
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              disabled={busy}
            />
            <small>Solo minúsculas, números y guiones. Ejemplo: orlando-2027.</small>
            <FieldError message={validation.fields.slug} />
          </label>

          <label>
            <span>País</span>
            <select
              value={form.countryCode}
              onChange={(event) => {
                update('countryCode', event.target.value);
                update('regionCode', '');
              }}
              disabled={busy}
            >
              <option value="">Seleccioná un país</option>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
            <FieldError message={validation.fields.countryCode} />
          </label>

          <label>
            <span>Provincia / estado <small>(opcional)</small></span>
            <select
              value={form.regionCode}
              onChange={(event) => update('regionCode', event.target.value)}
              disabled={busy || !form.countryCode || regions.length === 0}
            >
              <option value="">{regions.length ? 'Sin provincia / estado' : 'No hay subdivisiones disponibles'}</option>
              {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
            </select>
            <FieldError message={validation.fields.regionCode} />
          </label>

          <label className="trip-form-wide">
            <span>Ciudad <small>(opcional)</small></span>
            <input
              value={form.destination}
              onChange={(event) => update('destination', event.target.value)}
              maxLength={160}
              placeholder="Ej. Orlando"
              autoComplete="off"
              disabled={busy}
            />
            <FieldError message={validation.fields.destination} />
          </label>

          <label>
            <span>Fecha de inicio</span>
            <input
              type="date"
              value={form.startsOn}
              onChange={(event) => update('startsOn', event.target.value)}
              disabled={busy}
            />
            <FieldError message={validation.fields.startsOn} />
          </label>

          <label>
            <span>Fecha de fin <small>(opcional)</small></span>
            <input
              type="date"
              value={form.endsOn}
              min={form.startsOn || undefined}
              onChange={(event) => update('endsOn', event.target.value)}
              disabled={busy}
            />
            <FieldError message={validation.fields.endsOn} />
          </label>
        </div>

        <div className={`timezone-preview${timezone ? '' : ' warning'}`}>
          <span>Zona horaria detectada</span>
          <strong>{timezone || 'No se pudo determinar automáticamente'}</strong>
        </div>

        {validation.form ? <div className="inline-status error">{validation.form}</div> : null}
        {error ? <div className="inline-status error" aria-live="polite">{error}</div> : null}

        <div className="trip-form-actions">
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Guardando…' : submitLabel}
          </button>
          {onDelete ? (
            <button className="danger-button" type="button" onClick={() => void onDelete()} disabled={busy}>
              Eliminar viaje
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
