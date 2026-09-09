import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { appRoutes } from '../app/routes';
import { useAuth } from '../features/auth/AuthProvider';
import { loadTripDetail, updateTripSettings } from '../features/trips/api/trips-api';
import { formatTripStartDate } from '../features/trips/model/countdown';
import { TRIP_SETTINGS_LIMITS, validateTripSettingsForm, type TripSettingsFormValues } from '../features/trips/model/trip-settings-form';
import type { TripDetail } from '../features/trips/model/trip';
import { useTrips } from '../features/trips/TripsProvider';
import { ApiError } from '../shared/api/http-client';
import { SessionExpiredError } from '../shared/api/supabase-functions';
import { fileToBase64, validateTripImage } from '../shared/images/trip-images';

const EMPTY_FORM: TripSettingsFormValues = {
  eyebrow: '',
  title: '',
  subtitle: '',
  photoCredit: '',
};

function safeHttpsUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function TripSettingsPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { status: tripsStatus, findAccess } = useTrips();
  const access = useMemo(() => findAccess(slug), [findAccess, slug]);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<TripSettingsFormValues>(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (tripsStatus !== 'ready' || !access) return;
    const currentGeneration = ++generation.current;
    setLoadStatus('loading');
    setLoadError('');
    setMessage('');
    setConflict(false);

    void loadTripDetail(access.trip.slug)
      .then((result) => {
        if (generation.current !== currentGeneration) return;
        if (!result.permissions.includes('trip.edit')) {
          setLoadError('Ya no tenés permiso para configurar este viaje.');
          setLoadStatus('error');
          return;
        }
        setDetail(result);
        setForm({
          eyebrow: result.settings.eyebrow || '',
          title: result.settings.title || '',
          subtitle: result.settings.subtitle || '',
          photoCredit: result.settings.photoCredit || '',
        });
        setSelectedFile(null);
        setRemoveBackground(false);
        if (fileInput.current) fileInput.current.value = '';
        setLoadStatus('ready');
      })
      .catch(async (error: unknown) => {
        if (generation.current !== currentGeneration) return;
        if (error instanceof SessionExpiredError) {
          await logout();
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la configuración.');
        setLoadStatus('error');
      });

    return () => {
      generation.current += 1;
    };
  }, [access, logout, reloadKey, tripsStatus]);

  const updateField = (field: keyof TripSettingsFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] || null;
    const error = validateTripImage(file);
    if (error) {
      event.currentTarget.value = '';
      setSelectedFile(null);
      setMessage(error);
      return;
    }
    setSelectedFile(file);
    if (file) setRemoveBackground(false);
    setMessage('');
    setConflict(false);
  };

  const handleRemoveBackground = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.currentTarget.checked;
    setRemoveBackground(checked);
    if (checked) {
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = '';
    }
    setMessage('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !access || busy) return;

    const validation = validateTripSettingsForm(form);
    if (validation.error || !validation.value) {
      setMessage(validation.error || 'Revisá los campos antes de guardar.');
      return;
    }

    const imageError = validateTripImage(selectedFile);
    if (imageError) {
      setMessage(imageError);
      return;
    }

    const updatedAt = detail.settings.updatedAt;
    if (!updatedAt) {
      setMessage('No se pudo verificar la versión de la configuración. Recargala antes de guardar.');
      setConflict(true);
      return;
    }

    const requestGeneration = generation.current;
    setBusy(true);
    setMessage('Guardando configuración…');
    setConflict(false);

    try {
      const backgroundImage = selectedFile
        ? {
            contentBase64: await fileToBase64(selectedFile),
            contentType: selectedFile.type,
          }
        : undefined;
      if (generation.current !== requestGeneration) return;

      await updateTripSettings({
        slug: access.trip.slug,
        updatedAt,
        ...validation.value,
        removeBackground,
        ...(backgroundImage ? { backgroundImage } : {}),
      });
      if (generation.current !== requestGeneration) return;
      navigate(appRoutes.trip(access.trip.slug), { replace: true });
    } catch (error) {
      if (generation.current !== requestGeneration) return;
      if (error instanceof SessionExpiredError) {
        await logout();
        return;
      }
      setConflict(error instanceof ApiError && error.status === 409);
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
    } finally {
      if (generation.current === requestGeneration) setBusy(false);
    }
  };

  if (tripsStatus !== 'ready' || loadStatus === 'idle' || loadStatus === 'loading') {
    return <section className="workspace-card"><div className="inline-status">Cargando apariencia…</div></section>;
  }

  if (loadStatus === 'error' || !detail || !access) {
    return (
      <section className="workspace-card compact-workspace">
        <div className="eyebrow">Apariencia</div>
        <h1>No se pudo abrir la configuración.</h1>
        <p className="lead">{loadError || 'El viaje ya no está disponible.'}</p>
        <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.trips)}>Volver a Mis viajes</button>
      </section>
    );
  }

  const currentBackground = safeHttpsUrl(detail.settings.backgroundUrl);
  const effectiveBackground = previewUrl || (!removeBackground ? currentBackground : null);
  const imageState = selectedFile
    ? `Nueva imagen: ${selectedFile.name}`
    : removeBackground
      ? 'La imagen se quitará al guardar.'
      : currentBackground
        ? 'Imagen actual guardada'
        : 'Sin imagen de fondo';

  return (
    <section className="workspace-card trip-settings-page">
      <div className="page-heading settings-heading">
        <div>
          <div className="eyebrow">Apariencia del viaje</div>
          <h1>Configurar apariencia</h1>
          <p className="lead">{access.trip.name}</p>
        </div>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => navigate(appRoutes.trip(access.trip.slug))}>
          Volver al viaje
        </button>
      </div>

      <form className="trip-settings-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="settings-fields" disabled={busy}>
          <label>
            <span>Encabezado <small>(opcional)</small></span>
            <input
              value={form.eyebrow}
              maxLength={TRIP_SETTINGS_LIMITS.eyebrow}
              placeholder="Próxima parada: Orlando"
              onChange={(event) => updateField('eyebrow', event.currentTarget.value)}
            />
          </label>

          <label>
            <span>Título</span>
            <input
              value={form.title}
              maxLength={TRIP_SETTINGS_LIMITS.title}
              required
              onChange={(event) => updateField('title', event.currentTarget.value)}
            />
          </label>

          <label>
            <span>Subtítulo <small>(opcional)</small></span>
            <textarea
              value={form.subtitle}
              maxLength={TRIP_SETTINGS_LIMITS.subtitle}
              rows={3}
              onChange={(event) => updateField('subtitle', event.currentTarget.value)}
            />
          </label>

          <div className="settings-image-field">
            <span className="settings-label">Imagen de fondo</span>
            <input
              ref={fileInput}
              className="settings-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />
            <div className="settings-image-actions">
              <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}>
                {effectiveBackground ? 'Cambiar imagen' : 'Elegir imagen'}
              </button>
              <span className="settings-image-state" aria-live="polite">{imageState}</span>
            </div>
            {effectiveBackground ? <img className="settings-image-thumbnail" src={effectiveBackground} alt="Vista previa de la imagen de fondo" /> : null}
            <small>JPG, PNG o WebP. Máximo 4 MB. El backend verifica además la firma real del archivo.</small>
            {currentBackground && !selectedFile ? (
              <label className="settings-checkbox">
                <input type="checkbox" checked={removeBackground} onChange={handleRemoveBackground} />
                <span>Quitar la imagen actual</span>
              </label>
            ) : null}
          </div>

          <label>
            <span>Crédito de la imagen <small>(opcional)</small></span>
            <input
              value={form.photoCredit}
              maxLength={TRIP_SETTINGS_LIMITS.photoCredit}
              placeholder="Foto de…"
              onChange={(event) => updateField('photoCredit', event.currentTarget.value)}
            />
          </label>
        </fieldset>

        <div className="settings-preview-section">
          <h2>Vista previa</h2>
          <div className="trip-settings-preview">
            {effectiveBackground ? <img className="trip-settings-preview-image" src={effectiveBackground} alt="" aria-hidden="true" /> : null}
            <div className="trip-settings-preview-overlay" />
            <div className="trip-settings-preview-content">
              <div className="eyebrow">{form.eyebrow.trim() || 'Próximo viaje'}</div>
              <h3>{form.title.trim() || 'Título del viaje'}</h3>
              {form.subtitle.trim() ? <p>{form.subtitle.trim()}</p> : null}
              <div className="date-pill">{formatTripStartDate(detail.settings.defaultArrivalAt, detail.settings.defaultTimezone)}</div>
              {form.photoCredit.trim() ? <p className="photo-credit">{form.photoCredit.trim()}</p> : null}
            </div>
          </div>
          <small>La cuenta regresiva apunta al comienzo del viaje.</small>
        </div>

        {message ? <div className={`inline-status ${message === 'Guardando configuración…' ? '' : 'error'}`} aria-live="polite">{message}</div> : null}
        {conflict ? (
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setReloadKey((value) => value + 1)}>
            Recargar configuración
          </button>
        ) : null}
        <button className="primary-button settings-save" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>
    </section>
  );
}
