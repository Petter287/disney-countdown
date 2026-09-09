# Participantes del viaje en React

Esta etapa migra `/#/trips/:slug/participants` a React reutilizando el contrato backend existente de `trip-api`.

## Alcance

- Resumen de participantes totales, con acceso global activo y usuarios disponibles para agregar.
- Listado de participantes actuales con rol y estado de acceso global.
- El propietario del viaje se muestra protegido: no se puede cambiar su rol ni quitarlo desde la UI.
- Alta de uno o varios participantes con rol inicial.
- Cambio de rol de participantes no propietarios.
- Eliminación de participantes no propietarios.
- La selección múltiple usa `Promise.allSettled`: si una asignación falla y otras funcionan, la pantalla vuelve a consultar el estado real y muestra un resultado parcial en lugar de quedar desactualizada.

## Seguridad y permisos

La ruta está protegida por `TripPermissionRoute` con `members.manage`, pero el guard de React es solo UX. `trip-api` vuelve a exigir `members.manage` para `trip-admin`, `assign`, `update-role` y `remove`.

El backend también protege invariantes que el frontend no puede reemplazar: solo permite asignar perfiles con acceso global activo, valida el rol, evita membresías duplicadas y rechaza cualquier intento de cambiar o quitar al propietario.

Los nombres y emails se renderizan como texto JSX; no se inyecta HTML proveniente de perfiles.

## Sesiones y operaciones asíncronas

Todas las llamadas usan `callProtectedFunction`. Los `401` se convierten en `SessionExpiredError` y fuerzan logout. La pantalla mantiene una generación local para ignorar respuestas que lleguen después de navegación o cierre de sesión, incluso durante cambios de rol y eliminaciones.

## Backend

No se modifica PostgreSQL, RLS ni la Edge Function. Se reutilizan las acciones ya versionadas:

- `trip-admin`
- `assign`
- `update-role`
- `remove`

## Fuera de alcance

La administración global de usuarios sigue como placeholder y se migra en la etapa siguiente.
