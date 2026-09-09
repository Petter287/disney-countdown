import { Link } from 'react-router-dom';
import { appRoutes } from '../app/routes';

const targets = [
  ['Auth', appRoutes.login],
  ['Viajes', appRoutes.trips],
  ['Detalle', appRoutes.trip('orlando-2027')],
  ['Apariencia', appRoutes.tripSettings('orlando-2027')],
  ['Participantes', appRoutes.tripParticipants('orlando-2027')],
  ['Usuarios', appRoutes.users],
] as const;

export function FoundationPage() {
  return (
    <main className="foundation-shell">
      <section className="foundation-card">
        <span className="eyebrow">Migración arquitectónica</span>
        <h1>Mis Viajes · React + TypeScript</h1>
        <p className="lead">
          Esta es la nueva carcasa del frontend. La aplicación legacy sigue intacta en la raíz del repositorio mientras migramos pantalla por pantalla.
        </p>

        <div className="status-grid" aria-label="Estado de la arquitectura">
          <article><strong>React</strong><span>UI y componentes</span></article>
          <article><strong>TypeScript</strong><span>tipado estricto</span></article>
          <article><strong>Vite</strong><span>build y desarrollo</span></article>
          <article><strong>HashRouter</strong><span>compatible con GitHub Pages</span></article>
        </div>

        <h2>Rutas preparadas</h2>
        <div className="route-grid">
          {targets.map(([label, route]) => <Link key={label} to={route}>{label}</Link>)}
        </div>

        <p className="note">
          En esta etapa no se cambió autenticación, base de datos ni backend. Supabase y la web legacy siguen siendo la fuente funcional hasta que cada módulo sea migrado y probado.
        </p>
      </section>
    </main>
  );
}
