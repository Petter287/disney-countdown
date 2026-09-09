import { describe, expect, it } from 'vitest';
import {
  availableParticipantIdentity,
  defaultParticipantRole,
  participantIdentity,
  summarizeParticipants,
} from './participant-utils';
import type { AvailableParticipant, ParticipantRole, TripParticipant } from './participant';

const roles: ParticipantRole[] = [
  { id: 1, code: 'admin', name: 'Administrador' },
  { id: 2, code: 'editor', name: 'Editor' },
  { id: 3, code: 'viewer', name: 'Visualizador' },
];

const member = (enabled: boolean, displayName: string | null = 'Lucas'): TripParticipant => ({
  userId: crypto.randomUUID(),
  roleId: 3,
  isOwner: false,
  role: { code: 'viewer', name: 'Visualizador' },
  profile: { email: 'lucas@example.com', displayName, enabled },
});

const available: AvailableParticipant = {
  id: crypto.randomUUID(),
  email: 'invitado@example.com',
  displayName: null,
};

describe('participant utils', () => {
  it('uses display name first and falls back to email', () => {
    expect(participantIdentity(member(true))).toBe('Lucas');
    expect(participantIdentity(member(true, '   '))).toBe('lucas@example.com');
    expect(availableParticipantIdentity(available)).toBe('invitado@example.com');
  });

  it('summarizes total, globally active and available users', () => {
    expect(summarizeParticipants([member(true), member(false)], [available])).toEqual({
      total: 2,
      active: 1,
      available: 1,
    });
  });

  it('defaults new assignments to viewer when available', () => {
    expect(defaultParticipantRole(roles)).toBe('viewer');
    expect(defaultParticipantRole(roles.slice(0, 2))).toBe('admin');
    expect(defaultParticipantRole([])).toBe('');
  });
});
