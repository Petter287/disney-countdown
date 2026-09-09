# CRUD de viajes en React

Esta etapa reemplaza los placeholders de alta y edición de viajes por pantallas React conectadas al `trip-api` existente.

## Alcance

- `/#/trips/new`: alta de viaje.
- `/#/trips/:slug/edit`: edición y eliminación.
- Formulario compartido para nombre, slug, país, provincia/estado, ciudad y fechas.
- Detección de zona horaria con las mismas librerías que usaba la aplicación legacy, ahora como dependencias npm versionadas.
- Refresco de `TripsProvider` después de crear, editar o eliminar.
- Redirección segura cuando cambia el slug o se elimina un viaje.

## Seguridad

El frontend muestra estas rutas únicamente al `System Owner` mediante `SystemOwnerRoute`, pero esa comprobación es solo una mejora de UX. `trip-api` vuelve a exigir `profile.is_system_owner` para `trip-manage-detail`, `trip-create`, `trip-update` y `trip-delete`.

No se accede directamente a PostgreSQL desde React y no se agrega ninguna clave privilegiada al bundle. Las llamadas siguen pasando por `callProtectedFunction` y un 401 invalida la sesión de la aplicación.

## Validación

La validación cliente replica los límites principales del backend: slug, país, región, longitudes, fechas y zona horaria. El backend sigue siendo la autoridad final y devuelve errores de negocio, incluidos slug duplicado, viaje inexistente y ubicación inválida.

## Dependencias geográficas

- `country-state-city@3.2.1`
- `tz-lookup@6.1.25`

Se mantienen las mismas versiones que ya utilizaba el frontend legacy, pero dejan de cargarse desde CDN para pasar por el build de Vite.

## Fuera de alcance

La imagen de fondo no forma parte del CRUD general: continúa perteneciendo a la futura migración de Apariencia. Participantes y usuarios globales siguen pendientes.
