export interface SystemUserMembership {
  tripId: string;
  role: string;
  roleName: string;
  isOwner: boolean;
}

export interface SystemUser {
  id: string;
  email: string;
  displayName?: string | null;
  enabled: boolean;
  systemOwner: boolean;
  mustChangePassword: boolean;
  memberships: SystemUserMembership[];
}

export interface SystemTrip {
  id: string;
  name: string;
  destination?: string | null;
}

export interface SystemRole {
  id: number | string;
  code: string;
  name: string;
}

export interface SystemUsersPayload {
  users: SystemUser[];
  trips: SystemTrip[];
  roles: SystemRole[];
}

export interface SystemUserAssignment {
  tripId: string;
  role: string;
}

export interface CreateSystemUserInput {
  displayName: string;
  email: string;
  temporaryPassword: string;
  assignments: SystemUserAssignment[];
}

export interface UpdateSystemUserInput {
  userId: string;
  displayName: string;
  email: string;
  enabled: boolean;
  assignments: SystemUserAssignment[];
}
