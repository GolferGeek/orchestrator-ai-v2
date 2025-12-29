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

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing environment variables. Supabase authentication will not work.',
    '\n  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗',
    '\n  NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗'
  )
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:6010',
  supabaseAnonKey || 'placeholder-key'
)

/**
 * Check if Supabase is properly configured.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
