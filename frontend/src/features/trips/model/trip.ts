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

export interface TripManageDetail {
  trip: Trip;
  settings: {
    defaultTimezone: string;
    backgroundUrl?: string | null;
  };
}

export interface TripMutationInput {
  slug: string;
  name: string;
  destination: string;
  countryCode: string;
  regionCode: string | null;
  startsOn: string;
  endsOn: string | null;
  defaultTimezone: string;
}

export interface TripMutationResponse {
  ok: true;
  trip: Trip;
}

export interface TripBackgroundImageInput {
  contentBase64: string;
  contentType: string;
}

export interface TripSettingsUpdateInput {
  slug: string;
  updatedAt: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  photoCredit: string;
  removeBackground: boolean;
  backgroundImage?: TripBackgroundImageInput;
}

export interface TripSettingsUpdateResponse {
  ok: true;
  trip: Pick<Trip, 'id' | 'slug'>;
}
