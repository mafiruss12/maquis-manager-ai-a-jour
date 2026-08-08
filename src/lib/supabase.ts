import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Préférer les variables Vercel / .env :
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 * Fallback uniquement pour ne pas casser un déploiement sans env.
 */
const FALLBACK_URL = 'https://ycoaxbgxstxondxxnhhf.supabase.co';
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljb2F4Ymd4c3R4b25keHhuaGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTg5MTgsImV4cCI6MjEwMTE5NDkxOH0.iSPqcC8X1BXlgVYfhtFBY4QFq9UwiMycSisfhkNxV80';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

const supabaseUrl =
  envUrl && envUrl.startsWith('http') && !envUrl.includes('placeholder') ? envUrl : FALLBACK_URL;
const supabaseAnonKey =
  envKey && envKey.length > 20 && envKey !== 'placeholder-key' ? envKey : FALLBACK_ANON;

/** true si URL + clé disponibles (env ou fallback) */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** true si les variables d'environnement Vercel/.env sont bien définies */
export const usingEnvCredentials = Boolean(
  envUrl && envUrl.startsWith('http') && envKey && envKey.length > 20
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
