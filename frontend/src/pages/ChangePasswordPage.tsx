import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { AuthLoading } from '../features/auth/ProtectedRoute';
import { validateNewPassword } from '../features/auth/model/auth-validation';

export function ChangePasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (auth.status === 'loading') return <AuthLoading />;
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />;
  if (!auth.profile?.mustChangePassword) return <Navigate to="/trips" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateNewPassword(password, confirmation);
    if (validation) return setError(validation);

    setBusy(true);
    setError('');
    try {
      await auth.completePassword(password);
      setPassword('');
      setConfirmation('');
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-icon">🔐</div>
        <p className="eyebrow">Primer ingreso</p>
        <h1>Crear contraseña personal</h1>
        <p className="lead">Antes de continuar, reemplazá la contraseña temporal.</p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Nueva contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          <label>
            Repetir contraseña
            <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y continuar'}</button>
        </form>
        {error ? <p className="form-status error" role="alert">{error}</p> : null}
        <p className="security-note">Debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo. Al terminar se cierra la sesión y tenés que ingresar nuevamente.</p>
      </section>
    </main>
  );
}
