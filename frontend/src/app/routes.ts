export const appRoutes = {
  home: '/',
  login: '/login',
  trips: '/trips',
  users: '/users',
  trip: (slug: string) => `/trips/${encodeURIComponent(slug)}`,
  tripEdit: (slug: string) => `/trips/${encodeURIComponent(slug)}/edit`,
  tripSettings: (slug: string) => `/trips/${encodeURIComponent(slug)}/settings`,
  tripParticipants: (slug: string) => `/trips/${encodeURIComponent(slug)}/participants`,
} as const;
