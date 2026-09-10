import { describe, expect, it } from 'vitest';
import { assignmentsFromDraft, buildAssignmentDraft, normalizeSystemUserForm, validateSystemUserForm } from './system-user-form';
import type { SystemTrip, SystemUser } from './system-user';

const trips: SystemTrip[] = [
  { id: 'trip-1', name: 'Orlando' },
  { id: 'trip-2', name: 'Madrid' },
];

describe('system user form', () => {
  it('normalizes name and email but preserves password exactly', () => {
    expect(normalizeSystemUserForm({
      displayName: '  Lucas  ',
      email: '  TEST@Example.COM ',
      temporaryPassword: ' Abc123! ',
      enabled: true,
    })).toEqual({
      displayName: 'Lucas',
      email: 'test@example.com',
      temporaryPassword: ' Abc123! ',
      enabled: true,
    });
  });

  it('requires a strong temporary password only when creating', () => {
    const base = { displayName: 'Test', email: 'test@example.com', temporaryPassword: 'weak', enabled: true };
    expect(validateSystemUserForm(base, false).error).toContain('contraseña temporal');
    expect(validateSystemUserForm({ ...base, temporaryPassword: '' }, true).error).toBeNull();
  });

  it('locks owner memberships and keeps their role', () => {
    const user: SystemUser = {
      id: 'u1',
      email: 'owner@example.com',
      displayName: 'Owner',
      enabled: true,
      systemOwner: false,
      mustChangePassword: false,
      memberships: [{ tripId: 'trip-1', role: 'admin', roleName: 'Admin', isOwner: true }],
    };
    const draft = buildAssignmentDraft(trips, user);
    expect(draft['trip-1']).toEqual({ selected: true, role: 'admin', locked: true });
    expect(draft['trip-2']).toEqual({ selected: false, role: 'viewer', locked: false });
  });

  it('serializes only selected assignments', () => {
    expect(assignmentsFromDraft({
      a: { selected: true, role: 'editor', locked: false },
      b: { selected: false, role: 'viewer', locked: false },
    })).toEqual([{ tripId: 'a', role: 'editor' }]);
  });
});
