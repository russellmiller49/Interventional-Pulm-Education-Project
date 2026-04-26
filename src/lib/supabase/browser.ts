'use client'

import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

import { getSupabasePublicConfig, hasSupabasePublicConfig } from './config'

let browserClient: ReturnType<typeof createClient> | null = null
let cookieBrowserClient: ReturnType<typeof createBrowserClient> | null = null
let browserClientKey: string | null = null
let cookieBrowserClientKey: string | null = null

function getClientConfigKey(url: string, anonKey: string) {
  return `${url}::${anonKey}`
}

export function resetSupabaseBrowserClients() {
  browserClient = null
  cookieBrowserClient = null
  browserClientKey = null
  cookieBrowserClientKey = null
}

export function hasSupabaseBrowserConfig() {
  return hasSupabasePublicConfig()
}

export function supabaseBrowser() {
  const { url, anonKey } = getSupabasePublicConfig()
  const nextClientKey = getClientConfigKey(url, anonKey)

  if (browserClient && browserClientKey === nextClientKey) {
    return browserClient
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })
  browserClientKey = nextClientKey

  return browserClient
}

export function supabaseCookieBrowser() {
  const { url, anonKey } = getSupabasePublicConfig()
  const nextClientKey = getClientConfigKey(url, anonKey)

  if (cookieBrowserClient && cookieBrowserClientKey === nextClientKey) {
    return cookieBrowserClient
  }

  cookieBrowserClient = createBrowserClient(url, anonKey)
  cookieBrowserClientKey = nextClientKey

  return cookieBrowserClient
}
