# Auth y shell de sesión en React

La feature `feature/react-auth-shell` migra autenticación y ciclo de sesión al frontend React sin cambiar todavía el modelo de hosting gratuito.

## Flujo

1. React inicializa Supabase Auth y restaura la sesión persistida.
2. Si existe sesión, `trip-api { action: "bootstrap" }` valida JWT, `session_id`, sesión activa, acceso global y devuelve el perfil efectivo.
3. Las rutas privadas quedan detrás de `ProtectedRoute`.
4. Si `mustChangePassword=true`, el usuario solo puede continuar a `/change-password`.
5. El cambio obligatorio reutiliza `manage-system-user { action: "complete-password" }`; al completarse se cierra la sesión y se exige login nuevamente.
6. Logout limpia el estado React aunque el cierre remoto falle y Supabase conserva su fallback local.

## Seguridad

- Email y contraseña se envían a Supabase Auth únicamente mediante HTTPS; ver el body en DevTools no significa que viaje sin TLS.
- La publishable key puede existir en el bundle. Nunca se agrega `service_role`, `secret key` ni otra credencial privilegiada al frontend.
- La autorización real continúa en Edge Functions. `ProtectedRoute` es UX, no una barrera de seguridad suficiente por sí sola.
- Mientras no exista BFF/hosting de backend, la sesión de Supabase permanece en el almacenamiento del navegador. La migración a cookies HttpOnly queda fuera de la frontera de hosting gratuito definida para esta etapa.

## Configuración

`frontend/.env.example` documenta las variables de entorno. Los valores actuales también tienen fallback porque ya son datos públicos presentes en la aplicación legacy; cualquier entorno puede sobreescribirlos con `.env.local`.
