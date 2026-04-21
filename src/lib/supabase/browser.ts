'use client'

import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

import { getSupabasePublicConfig, hasSupabasePublicConfig } from './config'

let browserClient: ReturnType<typeof createClient> | null = null
let cookieBrowserClient: ReturnType<typeof createBrowserClient> | null = null

export function hasSupabaseBrowserConfig() {
  return hasSupabasePublicConfig()
}

export function supabaseBrowser() {
  if (browserClient) {
    return browserClient
  }

  const { url, anonKey } = getSupabasePublicConfig()

  browserClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })

  return browserClient
}

export function supabaseCookieBrowser() {
  if (cookieBrowserClient) {
    return cookieBrowserClient
  }

  const { url, anonKey } = getSupabasePublicConfig()

  cookieBrowserClient = createBrowserClient(url, anonKey)

  return cookieBrowserClient
}
