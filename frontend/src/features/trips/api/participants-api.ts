import { callProtectedFunction } from '../../../shared/api/supabase-functions';
import type { TripParticipantsData } from '../model/participant';

export async function loadTripParticipants(slug: string): Promise<TripParticipantsData> {
  const result = await callProtectedFunction<TripParticipantsData>('trip-api', {
    action: 'trip-admin',
    slug,
  });

  return {
    roles: result.roles || [],
    members: result.members || [],
    availableUsers: result.availableUsers || [],
  };
}

export async function assignTripParticipant(slug: string, userId: string, role: string): Promise<{ ok: true }> {
  return callProtectedFunction<{ ok: true }>('trip-api', {
    action: 'assign',
    slug,
    userId,
    role,
  });
}

export async function updateTripParticipantRole(slug: string, userId: string, role: string): Promise<{ ok: true }> {
  return callProtectedFunction<{ ok: true }>('trip-api', {
    action: 'update-role',
    slug,
    userId,
    role,
  });
}

export async function removeTripParticipant(slug: string, userId: string): Promise<{ ok: true }> {
  return callProtectedFunction<{ ok: true }>('trip-api', {
    action: 'remove',
    slug,
    userId,
  });
}
