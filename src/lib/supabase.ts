import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} else {
  // Client factice pour éviter le crash au démarrage
  // L'app affichera un message d'erreur clair
  console.error(
    '⚠️ Variables Supabase manquantes.\n' +
      'Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans Vercel → Settings → Environment Variables'
  );
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { supabase };
