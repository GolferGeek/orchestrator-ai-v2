import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for authentication.
 *
 * Uses environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: The Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: The Supabase anon/public key
 *
 * These must be set at build time (NEXT_PUBLIC_ prefix) to be available in the browser.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Note: Supabase is now optional - authentication uses the main API (api.orchestratorai.io)
// This client is kept for backward compatibility but may not be needed
// No warning needed since we're using the main API for auth

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
}
if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Check if Supabase is properly configured.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
