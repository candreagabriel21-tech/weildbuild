// ==================== SUPABASE CLIENT ====================
// Lazy initialization: Supabase createClient() crashes if the URL is empty.
// During `next build`, env vars aren't set yet, so we use a placeholder URL
// and only create the real client when it's actually needed at runtime.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_KEY || '';

    if (!url || !key) {
      console.warn('[Supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Database operations will fail.');
      // Use placeholder so createClient doesn't crash during build
      _supabase = createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY);
    } else {
      _supabase = createClient(url, key);
    }
  }
  return _supabase;
}

// Export as a getter so it's evaluated lazily (not at import time)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});
