# Usuarios globales en React

Esta etapa reemplaza el último placeholder principal del frontend nuevo: `/#/users` pasa a ser una pantalla React real conectada a la Edge Function `manage-system-user`.

## Alcance

- Listado de usuarios del sistema.
- Estado de acceso global.
- Indicador de System Owner.
- Indicador de cambio de contraseña pendiente.
- Alta de usuarios con contraseña temporal.
- Edición de nombre, email y acceso global.
- Habilitar/deshabilitar acceso.
- Asignación de viajes y roles.
- Preservación de membresías donde el usuario es propietario del viaje.

## Seguridad

La ruta `/users` está envuelta por `SystemOwnerRoute` para evitar mostrar la pantalla a usuarios comunes. Esto es únicamente un guard de UX: `manage-system-user` vuelve a validar en servidor que el actor tenga `is_system_owner = true` antes de listar o modificar usuarios.

La contraseña temporal se envía por HTTPS a la Edge Function y nunca se guarda en estado persistente propio de la aplicación. El backend crea la cuenta mediante Supabase Auth y marca `must_change_password = true` para exigir el cambio en el primer ingreso.

El frontend utiliza únicamente la publishable key. La clave privilegiada de Supabase permanece dentro de la Edge Function.

## Integridad de membresías

Cuando se edita un usuario, las membresías con `is_owner = true` aparecen bloqueadas. El backend también ignora intentos de quitar o cambiar esas membresías, de modo que la protección no depende de React.

## Sesiones y asincronía

Todas las operaciones usan `callProtectedFunction`. Un 401 se convierte en `SessionExpiredError` y fuerza logout. La pantalla usa una generación local para ignorar resultados que lleguen después de abandonar la ruta o cerrar sesión.

## Contrato backend reutilizado

Se mantiene la Edge Function existente `manage-system-user` con las acciones:

- `list`
- `create`
- `update`
- `toggle-access`

No se cambia PostgreSQL, Auth, RLS ni Storage en esta etapa.

## Pendiente arquitectónico

`manage-system-user` sigue desplegada en Supabase pero todavía no está versionada dentro del repositorio. Esa deuda se tratará como un bloque backend separado para no mezclar la migración visual con cambios de infraestructura.
