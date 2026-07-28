import { createClient } from '@supabase/supabase-js'

interface LiteratureDatabaseEnvironment {
  [key: string]: string | undefined
  LITERATURE_SUPABASE_SERVICE_ROLE_KEY?: string
  LITERATURE_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_URL?: string
}

export interface LiteratureDatabaseConfiguration {
  serviceRoleKey: string
  url: string
}

export function resolveLiteratureDatabaseConfiguration(
  env: LiteratureDatabaseEnvironment = process.env,
): LiteratureDatabaseConfiguration | null {
  const literatureUrl = env.LITERATURE_SUPABASE_URL?.trim()
  const literatureServiceRoleKey = env.LITERATURE_SUPABASE_SERVICE_ROLE_KEY?.trim()
  const hasLiteratureOverride = Boolean(literatureUrl || literatureServiceRoleKey)

  if (hasLiteratureOverride) {
    if (!literatureUrl || !literatureServiceRoleKey) {
      return null
    }
    return {
      url: literatureUrl,
      serviceRoleKey: literatureServiceRoleKey,
    }
  }

  const url = env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRoleKey) {
    return null
  }

  return { url, serviceRoleKey }
}

export function createLiteratureAdmin() {
  const configuration = resolveLiteratureDatabaseConfiguration()
  if (!configuration) {
    return null
  }

  return createClient(configuration.url, configuration.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
