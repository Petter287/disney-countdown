import type { Session } from '@supabase/supabase-js';
import { requestJson } from '../../../shared/api/http-client';
import { env } from '../../../shared/config/env';
import { supabase } from '../../../shared/supabase/client';
import type { AuthProfile } from '../model/auth';
import { normalizeLoginEmail } from '../model/auth-validation';

interface BootstrapResponse {
  profile: AuthProfile;
}

function functionUrl(name: string) {
  return `${env.supabaseUrl}/functions/v1/${name}`;
}

async function callFunction<T>(name: string, accessToken: string, payload: Record<string, unknown>): Promise<T> {
  return requestJson<T>(functionUrl(name), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function bootstrapProfile(session: Session): Promise<AuthProfile> {
  const result = await callFunction<BootstrapResponse>('trip-api', session.access_token, { action: 'bootstrap' });
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
  await callFunction('manage-system-user', session.access_token, {
    action: 'complete-password',
    password,
  });
}

export async function signOutEverywhere() {
  const { error } = await supabase.auth.signOut();
  if (!error) return;

  const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
  if (localError) throw localError;
}
