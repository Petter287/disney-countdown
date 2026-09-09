# Migración de viajes a React

Esta etapa reemplaza los placeholders de `Mis viajes` y del detalle del viaje por pantallas React conectadas al `trip-api` existente.

## Flujo

1. `TripsProvider` ejecuta `bootstrap` una vez para las rutas de viajes.
2. Conserva `accessibleTrips` y membresías en un contexto de feature.
3. `TripsPage` renderiza únicamente los viajes devueltos por backend.
4. `TripDetailPage` exige que el slug exista entre los viajes accesibles y luego solicita `trip-detail`.
5. El backend vuelve a validar `trip.view`; el guard del frontend es solo UX.
6. El countdown usa `defaultArrivalAt` y `defaultTimezone`, igual que la aplicación legacy.
7. Las URLs de fondo se aceptan para renderizado únicamente si usan HTTPS.

## Sesiones

Las llamadas privadas comparten `shared/api/supabase-functions.ts`. Un 401 se convierte en `SessionExpiredError`; los providers limpian la sesión antes de desmontar la UI privada.

## Alcance

Esta rama migra selector, detalle y countdown. Crear/editar viajes, apariencia, participantes y usuarios continúan como placeholders y se migran en etapas posteriores.

## Validación local

```bash
cd frontend
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Después del login, `/#/trips` debe mostrar los viajes reales del usuario y `/#/trips/:slug` debe cargar su configuración real desde `trip-api`.
