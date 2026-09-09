const FALLBACK_SUPABASE_URL = 'https://ezkjmskkfepgeupampdd.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sm6ncjG2aPyk5mCnDCLFlg_yzW5rczE';

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
} as const;
