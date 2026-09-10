import { STRONG_PASSWORD_RE } from '../../auth/model/auth-validation';
import type { SystemTrip, SystemUser, SystemUserAssignment } from './system-user';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SystemUserFormValues {
  displayName: string;
  email: string;
  temporaryPassword: string;
  enabled: boolean;
}

export interface AssignmentDraftEntry {
  selected: boolean;
  role: string;
  locked: boolean;
}

export type AssignmentDraft = Record<string, AssignmentDraftEntry>;

export function normalizeSystemUserForm(values: SystemUserFormValues): SystemUserFormValues {
  return {
    displayName: values.displayName.trim(),
    email: values.email.trim().toLowerCase(),
    temporaryPassword: values.temporaryPassword,
    enabled: values.enabled,
  };
}

export function validateSystemUserForm(values: SystemUserFormValues, editing: boolean) {
  const normalized = normalizeSystemUserForm(values);
  if (!normalized.displayName) return { error: 'Ingresá un nombre para el usuario.', value: null } as const;
  if (normalized.displayName.length > 120) return { error: 'El nombre no puede superar los 120 caracteres.', value: null } as const;
  if (!EMAIL_RE.test(normalized.email) || normalized.email.length > 254) {
    return { error: 'Ingresá un email válido.', value: null } as const;
  }
  if (!editing && !STRONG_PASSWORD_RE.test(normalized.temporaryPassword)) {
    return {
      error: 'La contraseña temporal debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo.',
      value: null,
    } as const;
  }
  return { error: null, value: normalized } as const;
}

export function buildAssignmentDraft(
  trips: SystemTrip[],
  user: SystemUser | null,
  fallbackRole = 'viewer',
): AssignmentDraft {
  const draft: AssignmentDraft = {};
  for (const trip of trips) {
    const membership = user?.memberships.find((item) => item.tripId === trip.id);
    draft[trip.id] = {
      selected: Boolean(membership),
      role: membership?.role || fallbackRole,
      locked: membership?.isOwner === true,
    };
  }
  return draft;
}

export function assignmentsFromDraft(draft: AssignmentDraft): SystemUserAssignment[] {
  return Object.entries(draft)
    .filter(([, entry]) => entry.selected)
    .map(([tripId, entry]) => ({ tripId, role: entry.role }));
}
