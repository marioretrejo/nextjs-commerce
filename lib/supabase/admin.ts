import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Service role client for webhook handlers and background jobs
// Never expose this on the client side
export function createAdminClient() {
  if (!process.env['NEXT_PUBLIC_SUPABASE_URL'] || !process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    throw new Error('Missing Supabase service role credentials');
  }

  return createClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL'],
    process.env['SUPABASE_SERVICE_ROLE_KEY'],
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
