/// <reference types="vite/client" />

declare module 'tz-lookup' {
  export default function tzlookup(latitude: number, longitude: number): string;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
