import type { AuthProfile } from './auth';

export function postLoginPath(profile: AuthProfile) {
  return profile.mustChangePassword ? '/change-password' : '/trips';
}
