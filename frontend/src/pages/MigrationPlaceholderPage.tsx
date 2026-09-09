import { Link } from 'react-router-dom';

export function MigrationPlaceholderPage({ title }: { title: string }) {
  return (
    <main className="foundation-shell">
      <section className="foundation-card compact">
        <span className="eyebrow">Módulo preparado</span>
        <h1>{title}</h1>
        <p className="lead">La ruta ya forma parte de la arquitectura React, pero su comportamiento legacy todavía no fue migrado.</p>
        <Link className="back-link" to="/">← Volver a la fundación</Link>
      </section>
    </main>
  );
}
