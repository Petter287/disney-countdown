import type { Session } from '@supabase/supabase-js';
import { callProtectedFunction } from '../../../shared/api/supabase-functions';
import { supabase } from '../../../shared/supabase/client';
import type { AuthProfile } from '../model/auth';
import { normalizeLoginEmail } from '../model/auth-validation';

interface BootstrapResponse {
  profile: AuthProfile;
}

export async function bootstrapProfile(session: Session): Promise<AuthProfile> {
  const result = await callProtectedFunction<BootstrapResponse>('trip-api', { action: 'bootstrap' }, session);
  return result.profile;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeLoginEmail(email),
    password,
  });
  if (error || !data.session || !data.user) throw new Error('Email o contraseña incorrectos.');
  return data;
}

export async function completeRequiredPassword(session: Session, password: string) {
  await callProtectedFunction('manage-system-user', {
    action: 'complete-password',
    password,
  }, session);
}

export async function signOutEverywhere() {
  const { error } = await supabase.auth.signOut();
  if (!error) return;

  const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
  if (localError) throw localError;
}
