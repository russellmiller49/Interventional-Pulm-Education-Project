import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase admin client with service role key.
 * This client bypasses Row Level Security - use only in server-side code (API routes).
 *
 * NEVER import this in client components or expose the service role key to the browser.
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.warn('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not set')
}

if (!serviceRoleKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is not set - admin client will not work')
}

/**
 * Creates a Supabase admin client for server-side operations.
 * Returns null if the required environment variables are not set.
 */
export const createSupabaseAdmin = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Singleton instance for convenience
export const supabaseAdmin = createSupabaseAdmin()
