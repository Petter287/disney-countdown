# ✨ Mis Viajes

Portal privado para centralizar distintos viajes, sus participantes y la información asociada a cada uno.

El proyecto nació como una cuenta regresiva para un viaje a Disney y evolucionó a una aplicación multi-viaje con autenticación, usuarios, roles y una API intermedia para acceder a los datos privados.

## Funcionalidades

- 🔐 Autenticación de usuarios.
- 🔑 Cambio obligatorio de contraseña temporal en el primer ingreso.
- 🌎 Múltiples viajes por usuario.
- 👥 Gestión global de usuarios por parte del propietario del sistema.
- 🎟️ Participantes y roles independientes por viaje.
- 🛡️ Roles `admin`, `editor` y `viewer` con permisos diferenciados.
- ⏳ Cuenta regresiva configurable por viaje.
- 🕐 Cuenta regresiva al inicio del viaje, a medianoche en la zona horaria del destino.
- 🎨 Configuración de encabezado, título, subtítulo, fondo y crédito, con vista previa.
- 👥 Pantalla dedicada para administrar participantes de cada viaje.
- 🚫 Posibilidad de habilitar o deshabilitar globalmente el acceso de un usuario sin eliminar sus viajes.

## Arquitectura

```text
GitHub Pages
    │
    ▼
Frontend (HTML / CSS / JavaScript)
    │
    ├── Supabase Auth
    │     └── autenticación y sesión
    │
    ▼
Supabase Edge Functions
    ├── trip-api
    │     └── viajes, configuración, participantes y roles
    │
    └── manage-system-user
          └── administración global de usuarios
    │
    ▼
Supabase PostgreSQL
    ├── profiles
    ├── trips
    ├── trip_settings
    ├── trip_members
    ├── roles
    ├── permissions
    └── role_permissions
```

El frontend no accede directamente a las tablas privadas. Supabase JS se utiliza en el navegador para autenticación y manejo de sesión, mientras que los datos de negocio se consumen mediante Edge Functions.

## Permisos

Los permisos se dividen en dos niveles:

- **Sistema:** el `System Owner` puede administrar usuarios, su acceso global y sus asignaciones a viajes.
- **Viaje:** cada usuario puede tener un rol diferente en cada viaje.

| Rol | Ver viaje | Editar viaje | Gestionar participantes |
| --- | :---: | :---: | :---: |
| `admin` | ✅ | ✅ | ✅ |
| `editor` | ✅ | ✅ | ❌ |
| `viewer` | ✅ | ❌ | ❌ |

## Seguridad

- Autenticación mediante Supabase Auth y JWT.
- Row Level Security (RLS) en PostgreSQL como capa adicional de protección.
- Operaciones privadas centralizadas en Edge Functions.
- Acceso global al sistema independiente de las membresías de cada viaje.
- Validación de permisos en backend; ocultar controles en el frontend no se considera una medida de autorización.
- El `service role` de Supabase permanece únicamente del lado servidor.

## Tecnologías

- HTML5
- CSS3
- JavaScript ES Modules
- Bootstrap 5
- Supabase Auth
- Supabase PostgreSQL
- Supabase Edge Functions (Deno / TypeScript)
- GitHub Pages

## Desarrollo local

### Configuración visual del viaje

La ruta `/#/trips/:slug/settings` se abre desde **Configurar apariencia** en el selector o en la pantalla del viaje. Requiere el permiso efectivo `trip.edit` (admin, editor o System Owner, incluso sin membresía). Un viewer no puede guardar cambios.

La imagen se administra únicamente desde **Configurar apariencia**. Crear y editar viajes contiene los datos generales, el destino y las fechas. Los viajes nuevos comienzan con fondo neutro; editar sus datos generales conserva la imagen existente.

El título es obligatorio (hasta 200 caracteres); encabezado (160), subtítulo (500) y crédito (300) son opcionales. El fondo admite JPG, PNG y WebP de hasta 4 MB, con validación de firma en backend, Storage privado y URLs temporales. Se puede reemplazar o quitar. Guardar vuelve al viaje y recarga su configuración; volver sin guardar descarta los cambios.

`trip-settings-update` valida la sesión activa y el permiso del viaje, y actualiza únicamente los campos visuales. `updatedAt` detecta ediciones simultáneas y responde 409 si la configuración cambió desde que se abrió el formulario. No modifica fechas, timezone, membresías ni datos generales del viaje.

### Participantes del viaje

La ruta `/#/trips/:slug/participants` concentra la administración de participantes y reemplaza la edición que antes estaba embebida dentro del modal **Mi viaje**. Se puede abrir desde el selector de viajes o desde la pantalla principal del viaje.

La pantalla requiere el permiso efectivo `members.manage`, por lo que está disponible para administradores del viaje y para el System Owner. Editores y viewers no pueden abrirla ni ejecutar sus acciones. El backend vuelve a validar el mismo permiso en `trip-api`.

Desde esta pantalla se puede:

- ver participantes actuales y su estado de acceso global;
- identificar al propietario del viaje, que no puede ser modificado ni removido;
- cambiar el rol de participantes no propietarios;
- quitar participantes;
- agregar uno o varios usuarios existentes y activos con un rol común;
- ver un resumen de participantes totales, activos y usuarios disponibles para agregar.

Los usuarios con acceso global deshabilitado permanecen visibles como miembros existentes, pero solo usuarios globalmente activos aparecen como candidatos para agregar.

El código de `trip-api` está versionado en `supabase/functions/trip-api/index.ts`, con `verify_jwt = true` en `supabase/config.toml`. La pantalla dedicada de participantes reutiliza las acciones existentes `trip-admin`, `assign`, `update-role` y `remove`, por lo que no requiere migración ni un contrato nuevo de backend.

### Validación

Las pruebas de API usan el handler real con un cliente Supabase simulado; no escriben datos de producción. Requieren Node con `node:module.stripTypeScriptTypes`:

```bash
node --input-type=module -e "import('./tests/trip-settings-api.mjs').then(async t => console.log(await t.runTests()))"
```

`tests/trip-settings-ui.mjs` exporta `runBrowserTests(browser, baseUrl)` para Playwright. Usa sesiones y respuestas simuladas, prueba edición, permisos, cancelación, imágenes, cierre de sesión y expiración.

`tests/trip-participants-ui.mjs` cubre la ruta dedicada de participantes, permisos, protección del propietario, alta, cambio de rol, baja, renderizado seguro de nombres, layout móvil, acceso del System Owner y limpieza por expiración de sesión.

Los tests de navegador necesitan un servidor HTTP local y las dependencias de CDN copiadas en `tmp/`: `bootstrap.min.css`, `bootstrap.bundle.min.js` (5.3.8), `country-state-city.js` (3.2.1, endpoint `+esm`) y `tz-lookup.js` (6.1.25, endpoint `+esm`).

### Servidor local

Al utilizar módulos ES, conviene servir el proyecto mediante un servidor HTTP local en lugar de abrir `index.html` directamente.

```bash
python -m http.server 8000
```

Luego se puede acceder desde `http://localhost:8000`.

## Publicación

El frontend se publica con GitHub Pages desde la rama `main`. El backend y la autenticación se ejecutan en Supabase.

El nombre técnico del repositorio se mantiene como `disney-countdown` por compatibilidad con la publicación existente, aunque el nombre visible actual del proyecto es **Mis Viajes**.
