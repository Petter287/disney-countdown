export const appRoutes = {
  home: '/',
  login: '/login',
  trips: '/trips',
  tripNew: '/trips/new',
  users: '/users',
  trip: (slug: string) => `/trips/${encodeURIComponent(slug)}`,
  tripEdit: (slug: string) => `/trips/${encodeURIComponent(slug)}/edit`,
  tripSettings: (slug: string) => `/trips/${encodeURIComponent(slug)}/settings`,
  tripParticipants: (slug: string) => `/trips/${encodeURIComponent(slug)}/participants`,
} as const;
