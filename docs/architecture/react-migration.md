# Migración del frontend a React + TypeScript

## Objetivo

Migrar la SPA Vanilla JS de forma incremental sin interrumpir la versión publicada en GitHub Pages ni cambiar todavía Supabase Auth, PostgreSQL, Storage o las Edge Functions.

## Principios

1. La aplicación legacy en la raíz sigue siendo funcional hasta alcanzar paridad.
2. El frontend nuevo vive en `frontend/`.
3. Cada pantalla se migra y prueba antes de retirar su equivalente legacy.
4. El frontend nuevo no debe acceder directamente a tablas privadas.
5. La autorización efectiva continúa validándose en backend.
6. La capa `shared/api` evita acoplar componentes React al transporte actual; más adelante puede apuntar a Edge Functions separadas o a otro backend sin reescribir las páginas.
7. Mientras el hosting siga siendo GitHub Pages, se usa hash routing y assets relativos.

## Orden previsto

1. Fundación React + TypeScript + Vite.
2. Auth y shell de sesión.
3. Selector y detalle de viajes.
4. CRUD de viajes.
5. Apariencia.
6. Participantes.
7. Usuarios globales.
8. Separación/refactor de Edge Functions por dominio.
9. Retiro del frontend legacy cuando exista paridad funcional y E2E.

## Frontera del hosting gratuito

Esta etapa sigue siendo compatible con GitHub Pages + Supabase. No introduce un servidor ASP.NET Core persistente ni cookies de sesión gestionadas por un BFF; ese cambio queda deliberadamente fuera hasta disponer de un hosting de backend apropiado.
