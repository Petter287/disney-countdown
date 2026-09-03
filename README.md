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
- 🕐 Ajuste de la fecha objetivo según ubicación y zona horaria cuando corresponde.
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

Al utilizar módulos ES, conviene servir el proyecto mediante un servidor HTTP local en lugar de abrir `index.html` directamente.

```bash
python -m http.server 8000
```

Luego se puede acceder desde `http://localhost:8000`.

## Publicación

El frontend se publica con GitHub Pages desde la rama `main`. El backend y la autenticación se ejecutan en Supabase.

El nombre técnico del repositorio se mantiene como `disney-countdown` por compatibilidad con la publicación existente, aunque el nombre visible actual del proyecto es **Mis Viajes**.
