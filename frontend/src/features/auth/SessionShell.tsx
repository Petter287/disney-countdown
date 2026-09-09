import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function SessionShell() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="session-shell">
      <header className="session-header">
        <div>
          <div className="eyebrow">Mis Viajes</div>
          <strong>{profile?.displayName || profile?.email}</strong>
          <div className="session-meta">
            {profile?.email}
            {profile?.systemOwner ? <span className="session-badge">System Owner</span> : null}
          </div>
        </div>
        <button className="secondary-button" type="button" onClick={handleLogout} disabled={busy}>
          {busy ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </header>
      <main className="session-content"><Outlet /></main>
    </div>
  );
}
