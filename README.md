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
- 🚫 Posibilidad de habilitar o deshabilitar globalmente el acceso de un usuario sin eliminar sus viajes.

## Arquitectura actual

```text
GitHub Pages
    │
    ▼
Frontend legacy (HTML / CSS / JavaScript)
    │
    ├── Supabase Auth
    ▼
Supabase Edge Functions
    ├── trip-api
    └── manage-system-user
    │
    ▼
Supabase PostgreSQL + Storage
```

El frontend no accede directamente a las tablas privadas. Supabase JS se utiliza en el navegador para autenticación y manejo de sesión, mientras que los datos de negocio se consumen mediante Edge Functions.

## Migración arquitectónica en curso

El nuevo frontend se desarrolla de forma incremental en `frontend/` con **React + TypeScript + Vite**. La aplicación legacy de la raíz se mantiene intacta y publicada mientras se migra pantalla por pantalla.

La nueva carcasa usa `HashRouter` y assets relativos para seguir siendo compatible con GitHub Pages sin pagar hosting. La capa `frontend/src/shared/api` establece una frontera de transporte para no acoplar los componentes al backend actual.

La decisión detallada y el orden de migración están documentados en `docs/architecture/react-migration.md`.

### Probar el frontend React localmente

Requisitos:

- Node.js 20 o superior.
- npm (incluido con Node.js).
- Git.

Desde la raíz del repositorio:

```bash
cd frontend
npm install
npm run dev
```

Abrí `http://localhost:5173/`. En esta primera etapa vas a ver la carcasa de migración y las rutas preparadas; todavía no usa datos reales ni reemplaza el frontend legacy.

Validaciones disponibles:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` genera `frontend/dist/`, compatible con publicación estática. `npm run preview` sirve ese build en `http://localhost:4173/`.

### Probar la aplicación legacy localmente

La aplicación actual sigue en la raíz. Como usa ES Modules, servila por HTTP:

```bash
python -m http.server 8000
```

Luego abrí `http://localhost:8000`.

## Permisos

Los permisos se dividen en sistema y viaje. El `System Owner` administra usuarios y acceso global; cada usuario puede tener un rol diferente por viaje.

| Rol | Ver viaje | Editar viaje | Gestionar participantes |
| --- | :---: | :---: | :---: |
| `admin` | ✅ | ✅ | ✅ |
| `editor` | ✅ | ✅ | ❌ |
| `viewer` | ✅ | ❌ | ❌ |

## Seguridad

- Autenticación mediante Supabase Auth y JWT.
- Row Level Security (RLS) como capa adicional de protección.
- Operaciones privadas centralizadas en Edge Functions.
- Validación de permisos en backend.
- El `service role` permanece únicamente del lado servidor.

## Tecnologías

### Actuales
- HTML5 / CSS3 / JavaScript ES Modules
- Bootstrap 5
- Supabase Auth / PostgreSQL / Storage / Edge Functions
- GitHub Pages

### Migración
- React
- TypeScript
- Vite
- React Router
- Vitest
- GitHub Actions

## Publicación

La versión funcional continúa publicándose con GitHub Pages desde `main`. El backend y la autenticación continúan en Supabase. El nombre técnico del repositorio se mantiene como `disney-countdown` por compatibilidad con la publicación existente.
