import type { AvailableParticipant, ParticipantRole, TripParticipant } from './participant';

export function participantIdentity(member: TripParticipant) {
  return member.profile.displayName?.trim() || member.profile.email || 'Usuario';
}

export function availableParticipantIdentity(user: AvailableParticipant) {
  return user.displayName?.trim() || user.email || 'Usuario';
}

export function summarizeParticipants(members: TripParticipant[], availableUsers: AvailableParticipant[]) {
  return {
    total: members.length,
    active: members.filter((member) => member.profile.enabled !== false).length,
    available: availableUsers.length,
  };
}

export function defaultParticipantRole(roles: ParticipantRole[]) {
  return roles.find((role) => role.code === 'viewer')?.code || roles[0]?.code || '';
}

export function participantRoleCode(member: TripParticipant, roles: ParticipantRole[]) {
  return member.role?.code || roles.find((role) => role.id === member.roleId)?.code || '';
}
