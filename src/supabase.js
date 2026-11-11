import { createClient } from '@supabase/supabase-js';

// A chave "publishable" é pública por desenho: quem protege os dados são as regras (RLS) do banco.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://kjjtpjfomtrkrxnekxrd.supabase.co';
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_AqDhsumaEFB1Lvi4-_ZWeQ_7AAxzIkX';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
