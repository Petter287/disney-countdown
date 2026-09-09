export interface ParticipantRole {
  id: number;
  code: string;
  name: string;
}

export interface ParticipantProfile {
  email: string;
  displayName: string | null;
  enabled: boolean;
}

export interface TripParticipant {
  userId: string;
  roleId: number;
  isOwner: boolean;
  role: Pick<ParticipantRole, 'code' | 'name'> | null;
  profile: ParticipantProfile;
}

export interface AvailableParticipant {
  id: string;
  email: string;
  displayName: string | null;
}

export interface TripParticipantsData {
  roles: ParticipantRole[];
  members: TripParticipant[];
  availableUsers: AvailableParticipant[];
}
