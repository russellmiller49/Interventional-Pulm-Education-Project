'use client'

import { useCallback, useEffect, useState } from 'react'

import SignInModal from '@/components/auth/SignInModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  hasSupabaseBrowserConfig,
  resetSupabaseBrowserClients,
  supabaseBrowser,
  supabaseCookieBrowser,
} from '@/lib/supabase/browser'
import { getSupabasePublicConfig, setSupabasePublicConfig } from '@/lib/supabase/config'

const embeddedCourseAppPath = '/socal-ebus-course/app/index.html'

type EmbedStatus = 'checking' | 'signed-in' | 'signed-out' | 'local-only' | 'error'

interface RuntimeSupabaseConfigResponse {
  anonKey: string | null
  configured: boolean
  url: string | null
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to verify the learner session for the embedded course.'
}

export function CourseEmbedShell() {
  const [status, setStatus] = useState<EmbedStatus>('checking')
  const [allowLocalOnly, setAllowLocalOnly] = useState(false)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(hasSupabaseBrowserConfig())
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const bridgeEmbeddedSession = useCallback(async (isActive = true) => {
    try {
      const cookieClient = supabaseCookieBrowser()
      const localStorageClient = supabaseBrowser()

      const [
        {
          data: { session: cookieSession },
          error: cookieError,
        },
        {
          data: { session: localSession },
        },
      ] = await Promise.all([cookieClient.auth.getSession(), localStorageClient.auth.getSession()])

      if (cookieError) {
        throw cookieError
      }

      if (!cookieSession) {
        if (localSession) {
          const { error: signOutError } = await localStorageClient.auth.signOut({
            scope: 'local',
          })

          if (signOutError) {
            throw signOutError
          }
        }

        if (!isActive) {
          return
        }

        setSessionEmail(null)
        setStatus('signed-out')
        setErrorMessage(null)
        return
      }

      if (!localSession || localSession.access_token !== cookieSession.access_token) {
        const { error: setSessionError } = await localStorageClient.auth.setSession({
          access_token: cookieSession.access_token,
          refresh_token: cookieSession.refresh_token,
        })

        if (setSessionError) {
          throw setSessionError
        }
      }

      if (!isActive) {
        return
      }

      setSessionEmail(cookieSession.user.email ?? null)
      setStatus('signed-in')
      setErrorMessage(null)
    } catch (error) {
      if (!isActive) {
        return
      }

      setSessionEmail(null)
      setStatus('error')
      setErrorMessage(formatErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    let isActive = true
    let unsubscribe: (() => void) | undefined

    async function initializeEmbeddedSessionBridge() {
      let resolvedConfig = hasSupabaseBrowserConfig() ? getSupabasePublicConfig() : null

      try {
        const response = await fetch('/api/public/supabase-config', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Unable to load public Supabase config (${response.status}).`)
        }

        const runtimeConfig = (await response.json()) as RuntimeSupabaseConfigResponse

        if (runtimeConfig.configured && runtimeConfig.url && runtimeConfig.anonKey) {
          resolvedConfig = {
            url: runtimeConfig.url,
            anonKey: runtimeConfig.anonKey,
          }
        }
      } catch (error) {
        if (!resolvedConfig && isActive) {
          setErrorMessage(formatErrorMessage(error))
        }
      }

      if (!isActive) {
        return
      }

      if (!resolvedConfig) {
        setSupabasePublicConfig(null)
        resetSupabaseBrowserClients()
        setIsSupabaseConfigured(false)
        setSessionEmail(null)
        setStatus('local-only')
        return
      }

      setSupabasePublicConfig(resolvedConfig)
      resetSupabaseBrowserClients()
      setIsSupabaseConfigured(true)
      setStatus('checking')
      setErrorMessage(null)

      const cookieClient = supabaseCookieBrowser()
      void bridgeEmbeddedSession(isActive)

      const {
        data: { subscription },
      } = cookieClient.auth.onAuthStateChange(() => {
        void bridgeEmbeddedSession(isActive)
      })

      unsubscribe = () => subscription.unsubscribe()
    }

    void initializeEmbeddedSessionBridge()

    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [bridgeEmbeddedSession])

  const shouldRenderEmbed = status === 'signed-in' || status === 'local-only' || allowLocalOnly

  return (
    <div className="space-y-6">
      {status === 'checking' ? (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase">
              Checking session
            </Badge>
            <p className="text-sm text-muted-foreground">
              Verifying the learner&apos;s Supabase session before loading the embedded course.
            </p>
          </div>
        </div>
      ) : null}

      {status === 'signed-in' ? (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success" className="rounded-full px-3 py-1 text-xs uppercase">
              Live sync ready
            </Badge>
            <p className="text-sm text-muted-foreground">
              {sessionEmail ? `Signed in as ${sessionEmail}.` : 'Signed-in learner detected.'} The
              embedded course can now reuse the same project session and sync progress under RLS.
            </p>
          </div>
        </div>
      ) : null}

      {status === 'signed-out' && !allowLocalOnly ? (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase">
                Local-only until sign-in
              </Badge>
              <p className="text-sm text-muted-foreground">
                The course app can work offline without a learner session, but live Supabase sync
                will stay off until the learner signs in on this site.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => setIsSignInOpen(true)}>
                Sign in for live sync
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAllowLocalOnly(true)}>
                Continue in local-only mode
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {status === 'error' && !allowLocalOnly ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase">
                Sync bridge needs attention
              </Badge>
              <p className="text-sm text-muted-foreground">
                {errorMessage ??
                  'The main site could not prepare the embedded session for live sync.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => setIsSignInOpen(true)}>
                Sign in again
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAllowLocalOnly(true)}>
                Continue in local-only mode
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!isSupabaseConfigured ? (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase">
                Offline-first mode
              </Badge>
              <p className="text-sm text-muted-foreground">
                The embedded course is available, but the public Supabase env is not configured in
                this deployment so learner activity will remain local-only.
              </p>
            </div>
            {errorMessage ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">{errorMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {shouldRenderEmbed ? (
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm">
          <iframe
            title="SoCal EBUS Course"
            src={embeddedCourseAppPath}
            className="h-[calc(100vh-12rem)] min-h-[780px] w-full bg-white"
          />
        </div>
      ) : null}

      {isSignInOpen ? <SignInModal onClose={() => setIsSignInOpen(false)} /> : null}
    </div>
  )
}
