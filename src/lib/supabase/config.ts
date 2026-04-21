const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

export function hasSupabasePublicConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export function getSupabasePublicConfig() {
  if (!hasSupabasePublicConfig()) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.',
    )
  }

  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  }
}
