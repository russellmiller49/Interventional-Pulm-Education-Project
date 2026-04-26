export interface SupabasePublicConfig {
  anonKey: string
  url: string
}

const buildTimeSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
const buildTimeSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

let runtimeSupabasePublicConfig: SupabasePublicConfig | null = null

function normalizeSupabasePublicConfig(
  config: SupabasePublicConfig | null | undefined,
): SupabasePublicConfig | null {
  const url = config?.url?.trim() ?? ''
  const anonKey = config?.anonKey?.trim() ?? ''

  if (!url || !anonKey) {
    return null
  }

  return { url, anonKey }
}

function readActiveSupabasePublicConfig() {
  return (
    runtimeSupabasePublicConfig ??
    normalizeSupabasePublicConfig({
      url: buildTimeSupabaseUrl,
      anonKey: buildTimeSupabaseAnonKey,
    })
  )
}

export function setSupabasePublicConfig(config: SupabasePublicConfig | null) {
  runtimeSupabasePublicConfig = normalizeSupabasePublicConfig(config)
}

export function hasSupabasePublicConfig() {
  return Boolean(readActiveSupabasePublicConfig())
}

export function getSupabasePublicConfig() {
  const activeConfig = readActiveSupabasePublicConfig()

  if (!activeConfig) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.',
    )
  }

  return activeConfig
}
