import { callProtectedFunction } from '../../../shared/api/supabase-functions';
import type {
  TripAccess,
  TripDetail,
  TripManageDetail,
  TripMembership,
  TripMutationInput,
  TripMutationResponse,
} from '../model/trip';

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

export async function loadTripManageDetail(slug: string): Promise<TripManageDetail> {
  return callProtectedFunction<TripManageDetail>('trip-api', {
    action: 'trip-manage-detail',
    slug,
  });
}

export async function createTrip(input: TripMutationInput): Promise<TripMutationResponse> {
  return callProtectedFunction<TripMutationResponse>('trip-api', {
    action: 'trip-create',
    ...input,
  });
}

export async function updateTrip(currentSlug: string, input: TripMutationInput): Promise<TripMutationResponse> {
  return callProtectedFunction<TripMutationResponse>('trip-api', {
    action: 'trip-update',
    currentSlug,
    ...input,
  });
}

export async function deleteTrip(slug: string): Promise<{ ok: true }> {
  return callProtectedFunction<{ ok: true }>('trip-api', {
    action: 'trip-delete',
    slug,
  });
}
