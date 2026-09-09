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

La rama base de esta migración es `refactor/react-typescript-foundation`. Las features de esta nueva arquitectura se crean a partir de esa rama en lugar de `main`.

La nueva carcasa usa `HashRouter` y assets relativos para seguir siendo compatible con GitHub Pages sin pagar hosting. La capa `frontend/src/shared/api` establece una frontera de transporte para no acoplar los componentes al backend actual.

La decisión detallada y el orden de migración están documentados en `docs/architecture/react-migration.md`.

### Auth y shell de sesión React

La rama `feature/react-auth-shell` agrega al frontend nuevo:

- Supabase Auth.
- Restauración y renovación de sesión.
- Validación del perfil mediante `trip-api` / `bootstrap`.
- Login y logout.
- Rutas privadas mediante `ProtectedRoute`.
- Cambio obligatorio de contraseña reutilizando `manage-system-user`.
- Shell autenticado con perfil y badge de `System Owner`.

Mientras se mantenga GitHub Pages como hosting gratuito, la sesión permanece gestionada por Supabase en el navegador. Una futura migración a cookies HttpOnly con BFF queda fuera de esta etapa.

### Probar el frontend React localmente

Requisitos:

- Node.js 20 o superior.
- npm (incluido con Node.js).
- Git.

Para probar la feature de autenticación:

```bash
git fetch
git switch feature/react-auth-shell
cd frontend
npm install
npm run dev
```

Abrí `http://localhost:5173/`. El login ya usa las cuentas reales de Supabase; las pantallas de viajes todavía son placeholders protegidos.

Validaciones disponibles:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`frontend/.env.example` documenta la configuración pública de Supabase. Los valores actuales tienen fallback para facilitar desarrollo local. Nunca deben agregarse `service_role`, secret keys ni otras credenciales privilegiadas al frontend.

Más detalle en `docs/architecture/react-auth.md`.

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
