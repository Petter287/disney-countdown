import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { SessionExpiredError } from '../../shared/api/supabase-functions';
import { loadTripsBootstrap } from './api/trips-api';
import type { TripAccess, TripMembership } from './model/trip';

type TripsStatus = 'loading' | 'ready' | 'error';

interface TripsContextValue {
  status: TripsStatus;
  error: string;
  memberships: TripMembership[];
  accessibleTrips: TripAccess[];
  refresh(): Promise<void>;
  findAccess(slug: string): TripAccess | null;
}

const TripsContext = createContext<TripsContextValue | null>(null);

export function TripsProvider() {
  const { logout } = useAuth();
  const [status, setStatus] = useState<TripsStatus>('loading');
  const [error, setError] = useState('');
  const [memberships, setMemberships] = useState<TripMembership[]>([]);
  const [accessibleTrips, setAccessibleTrips] = useState<TripAccess[]>([]);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    setStatus('loading');
    setError('');

    try {
      const result = await loadTripsBootstrap();
      if (generation.current !== currentGeneration) return;
      setMemberships(result.memberships);
      setAccessibleTrips(result.accessibleTrips);
      setStatus('ready');
    } catch (loadError) {
      if (generation.current !== currentGeneration) return;
      if (loadError instanceof SessionExpiredError) {
        await logout();
        return;
      }
      setMemberships([]);
      setAccessibleTrips([]);
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los viajes.');
      setStatus('error');
    }
  }, [logout]);

  useEffect(() => {
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);

  const value = useMemo<TripsContextValue>(() => ({
    status,
    error,
    memberships,
    accessibleTrips,
    refresh,
    findAccess: (slug: string) => accessibleTrips.find((access) => access.trip.slug === slug) || null,
  }), [status, error, memberships, accessibleTrips, refresh]);

  return (
    <TripsContext.Provider value={value}>
      <Outlet />
    </TripsContext.Provider>
  );
}

export function useTrips() {
  const value = useContext(TripsContext);
  if (!value) throw new Error('useTrips debe usarse dentro de TripsProvider.');
  return value;
}
