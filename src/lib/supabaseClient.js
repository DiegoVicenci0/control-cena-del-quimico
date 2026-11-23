import { createClient } from '@supabase/supabase-js';

const LS_URL = 'cena_supabase_url';
const LS_KEY = 'cena_supabase_anon_key';

export function getSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const lsUrl = typeof window !== 'undefined' ? window.localStorage.getItem(LS_URL) || '' : '';
  const lsKey = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) || '' : '';
  return {
    url: (envUrl || lsUrl).trim(),
    anonKey: (envKey || lsKey).trim(),
    fromEnv: Boolean(envUrl && envKey),
  };
}

export function saveSupabaseConfig(url, anonKey) {
  window.localStorage.setItem(LS_URL, url.trim());
  window.localStorage.setItem(LS_KEY, anonKey.trim());
}

export function clearSupabaseConfig() {
  window.localStorage.removeItem(LS_URL);
  window.localStorage.removeItem(LS_KEY);
}

export function createSupabaseFromConfig() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || url.includes('TU-PROYECTO')) return null;
  return createClient(url, anonKey);
}
