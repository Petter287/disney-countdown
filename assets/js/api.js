import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/+esm';

const SUPABASE_URL = 'https://ezkjmskkfepgeupampdd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sm6ncjG2aPyk5mCnDCLFlg_yzW5rczE';
const TRIP_API_URL = `${SUPABASE_URL}/functions/v1/trip-api`;
const SYSTEM_USER_API_URL = `${SUPABASE_URL}/functions/v1/manage-system-user`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function callApi(url, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('SESSION_EXPIRED');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

export const tripApi = (action, payload = {}) => callApi(TRIP_API_URL, { action, ...payload });
export const systemUserApi = (action, payload = {}) => callApi(SYSTEM_USER_API_URL, { action, ...payload });
