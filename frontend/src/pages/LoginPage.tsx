import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { postLoginPath } from '../features/auth/model/auth-navigation';

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.message) return;
    const state = location.state as { message?: string } | null;
    if (state?.message) setError(state.message);
  }, [auth.message, location.state]);

  if (auth.status === 'authenticated') return <Navigate to={postLoginPath(auth.profile!)} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    auth.clearMessage();
    try {
      const profile = await auth.login(email, password);
      setPassword('');
      navigate(postLoginPath(profile), { replace: true });
    } catch (cause) {
      setPassword('');
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-icon">🧳</div>
        <p className="eyebrow">Mis Viajes</p>
        <h1>Acceso a mis viajes</h1>
        <p className="lead">Ingresá con una cuenta autorizada.</p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" maxLength={254} />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          <button className="primary-button" type="submit" disabled={busy || auth.status === 'loading'}>
            {busy ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
        {(error || auth.message) ? <p className="form-status error" role="alert">{error || auth.message}</p> : null}
        <p className="security-note">La autenticación usa Supabase Auth sobre HTTPS. La publishable key es pública; las claves administrativas no viven en el frontend.</p>
      </section>
    </main>
  );
}
