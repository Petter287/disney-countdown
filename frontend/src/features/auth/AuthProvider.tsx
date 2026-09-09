import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { bootstrapProfile, completeRequiredPassword, signInWithPassword, signOutEverywhere } from './api/auth-api';
import type { AuthProfile, AuthStatus } from './model/auth';
import { supabase } from '../../shared/supabase/client';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  profile: AuthProfile | null;
  message: string;
  login(email: string, password: string): Promise<AuthProfile>;
  logout(): Promise<void>;
  completePassword(password: string): Promise<void>;
  clearMessage(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [message, setMessage] = useState('');
  const generation = useRef(0);

  const clearLocalAuth = useCallback((nextMessage = '') => {
    generation.current += 1;
    setUser(null);
    setProfile(null);
    setMessage(nextMessage);
    setStatus('anonymous');
  }, []);

  const hydrate = useCallback(async (session: Session | null) => {
    const currentGeneration = ++generation.current;
    if (!session?.user) {
      clearLocalAuth();
      return;
    }

    setStatus('loading');
    try {
      const nextProfile = await bootstrapProfile(session);
      if (generation.current !== currentGeneration) return;
      setUser(session.user);
      setProfile(nextProfile);
      setMessage('');
      setStatus('authenticated');
    } catch (error) {
      if (generation.current !== currentGeneration) return;
      try {
        await signOutEverywhere();
      } catch {
        // El estado local se limpia igualmente: no dejamos UI privada montada.
      }
      clearLocalAuth(error instanceof Error ? error.message : 'No se pudo validar tu acceso.');
    }
  }, [clearLocalAuth]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) void hydrate(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') clearLocalAuth();
      if (event === 'TOKEN_REFRESHED' && session) void hydrate(session);
    });

    return () => {
      mounted = false;
      generation.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [clearLocalAuth, hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    setMessage('');
    const data = await signInWithPassword(email, password);
    const nextProfile = await bootstrapProfile(data.session);
    generation.current += 1;
    setUser(data.user);
    setProfile(nextProfile);
    setStatus('authenticated');
    return nextProfile;
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOutEverywhere();
    } finally {
      clearLocalAuth();
    }
  }, [clearLocalAuth]);

  const completePassword = useCallback(async (password: string) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('La sesión venció. Iniciá sesión nuevamente.');
    await completeRequiredPassword(data.session, password);
    try {
      await signOutEverywhere();
    } finally {
      clearLocalAuth('Contraseña actualizada. Iniciá sesión nuevamente.');
    }
  }, [clearLocalAuth]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    profile,
    message,
    login,
    logout,
    completePassword,
    clearMessage: () => setMessage(''),
  }), [status, user, profile, message, login, logout, completePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return value;
}
