import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/+esm';

const SUPABASE_URL = 'https://ezkjmskkfepgeupampdd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sm6ncjG2aPyk5mCnDCLFlg_yzW5rczE';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const greeting = document.getElementById('tripGreeting');

async function refreshGreeting() {
  if (!greeting) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    greeting.textContent = '';
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const displayName = profile?.display_name?.trim();
  const fallbackName = user.email?.split('@')[0] || 'viajero';
  greeting.textContent = `Hola, ${displayName || fallbackName} 👋`;
}

supabase.auth.onAuthStateChange(() => refreshGreeting());
window.addEventListener('DOMContentLoaded', refreshGreeting);
