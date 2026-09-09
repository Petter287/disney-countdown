# Apariencia del viaje en React

Esta etapa migra `/#/trips/:slug/settings` desde la UI legacy a React sin cambiar el contrato backend de `trip-api`.

## Alcance

- Edición de encabezado, título, subtítulo y crédito de imagen.
- Carga, reemplazo y eliminación de imagen de fondo.
- Preview local antes de guardar.
- JPG, PNG y WebP con límite cliente de 4 MB.
- `trip-api` sigue validando MIME, tamaño y firma real del archivo antes de guardar en Storage privado.
- La imagen actual sigue llegando mediante URL firmada HTTPS.
- Después de guardar se vuelve al detalle del viaje, que vuelve a pedir `trip-detail` y obtiene la versión nueva.

## Permisos

La ruta usa `TripPermissionRoute` con `trip.edit` como guard de UX. Esto no reemplaza la autorización server-side: `trip-settings-update` vuelve a resolver el viaje y exige `trip.edit` antes de modificar datos o Storage.

## Concurrencia optimista

El formulario conserva el `updatedAt` recibido por `trip-detail` y lo manda a `trip-settings-update`. El backend compara ese valor con `trip_settings.updated_at`; si otra sesión cambió la configuración, responde 409 y React ofrece recargar la versión vigente antes de volver a guardar.

## Sesiones

Las operaciones pasan por `callProtectedFunction`. Un 401 genera `SessionExpiredError`, se limpia la sesión y se desmonta la UI privada. Las operaciones asíncronas usan una generación local para ignorar respuestas que lleguen después de un cambio de pantalla o cierre de sesión.

## Fuera de alcance

No se modifica PostgreSQL, Storage, RLS ni la Edge Function. Tampoco se migran todavía participantes ni usuarios globales.
