import { callProtectedFunction } from '../../../shared/api/supabase-functions';
import type {
  CreateSystemUserInput,
  SystemUsersPayload,
  UpdateSystemUserInput,
} from '../model/system-user';

export function loadSystemUsers(): Promise<SystemUsersPayload> {
  return callProtectedFunction<SystemUsersPayload>('manage-system-user', { action: 'list' });
}

export function createSystemUser(input: CreateSystemUserInput): Promise<{ ok: true; userId: string }> {
  return callProtectedFunction<{ ok: true; userId: string }>('manage-system-user', {
    action: 'create',
    ...input,
  });
}

export function updateSystemUser(input: UpdateSystemUserInput): Promise<{ ok: true }> {
  return callProtectedFunction<{ ok: true }>('manage-system-user', {
    action: 'update',
    ...input,
  });
}

export function toggleSystemUserAccess(userId: string, enabled: boolean): Promise<{ ok: true }> {
  return callProtectedFunction<{ ok: true }>('manage-system-user', {
    action: 'toggle-access',
    userId,
    enabled,
  });
}
