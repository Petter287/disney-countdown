import { Link } from 'react-router-dom';

export function AuthenticatedPlaceholderPage({ title }: { title: string }) {
  return (
    <section className="workspace-card">
      <p className="eyebrow">Migración incremental</p>
      <h1>{title}</h1>
      <p className="lead">La autenticación y el shell de sesión ya corren en React. Esta pantalla se migra en una feature posterior.</p>
      <Link className="back-link" to="/trips">Ir a Mis viajes</Link>
    </section>
  );
}
