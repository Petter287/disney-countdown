import type { Session } from '@supabase/supabase-js';
import { ApiError, requestJson } from './http-client';
import { env } from '../config/env';
import { supabase } from '../supabase/client';

export class SessionExpiredError extends Error {
  constructor(message = 'La sesión venció. Iniciá sesión nuevamente.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

function functionUrl(name: string) {
  return `${env.supabaseUrl}/functions/v1/${name}`;
}

export async function getCurrentSession(): Promise<Session> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new SessionExpiredError();
  return data.session;
}

export async function callProtectedFunction<T>(
  name: string,
  payload: Record<string, unknown>,
  session?: Session,
): Promise<T> {
  const activeSession = session ?? await getCurrentSession();

  try {
    return await requestJson<T>(functionUrl(name), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeSession.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new SessionExpiredError();
    throw error;
  }
}
