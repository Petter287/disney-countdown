import { callProtectedFunction } from '../../../shared/api/supabase-functions';
import type { TripAccess, TripDetail, TripMembership } from '../model/trip';

export interface TripsBootstrap {
  memberships: TripMembership[];
  accessibleTrips: TripAccess[];
}

interface BootstrapResponse extends TripsBootstrap {}

export async function loadTripsBootstrap(): Promise<TripsBootstrap> {
  const result = await callProtectedFunction<BootstrapResponse>('trip-api', { action: 'bootstrap' });
  return {
    memberships: result.memberships || [],
    accessibleTrips: result.accessibleTrips || [],
  };
}

export async function loadTripDetail(slug: string): Promise<TripDetail> {
  return callProtectedFunction<TripDetail>('trip-api', {
    action: 'trip-detail',
    slug,
  });
}
