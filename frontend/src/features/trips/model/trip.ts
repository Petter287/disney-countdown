export type TripPermission = 'trip.view' | 'trip.edit' | 'members.manage' | string;

export interface Role {
  id?: number | string;
  code: string;
  name: string;
}

export interface Trip {
  id: string;
  slug: string;
  name: string;
  destination: string;
  countryCode?: string | null;
  regionCode?: string | null;
  startsOn: string;
  endsOn?: string | null;
}

export interface TripMembership {
  tripId: string;
  roleId?: number | string;
  role?: Role | null;
  permissions?: TripPermission[];
  isOwner?: boolean;
  trip?: Trip | null;
}

export interface TripAccess {
  trip: Trip;
  membership: TripMembership | null;
  permissions: TripPermission[];
}

export interface TripSettings {
  tripId: string;
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  startAt: string;
  defaultArrivalAt: string;
  defaultTimezone: string;
  backgroundUrl?: string | null;
  photoCredit?: string | null;
  updatedAt?: string | null;
}

export interface TripDetail {
  trip: Pick<Trip, 'id' | 'slug'>;
  permissions: TripPermission[];
  settings: TripSettings;
}
