export interface AuthProfile {
  id: string;
  email: string;
  displayName?: string | null;
  enabled: boolean;
  systemOwner: boolean;
  mustChangePassword: boolean;
}

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';
