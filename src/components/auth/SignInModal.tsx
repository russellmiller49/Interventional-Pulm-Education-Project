'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabaseCookieBrowser } from '@/lib/supabase/browser'
import { buildSignInRedirectUrl } from '@/lib/supabase/auth-redirect'
import { buildLocalSupabaseRedirectUrl } from '@/lib/supabase/url'

interface SignInModalProps {
  onClose: () => void
}

type AuthMode = 'sign-in' | 'create-account' | 'reset-password'
type Status = 'idle' | 'submitting' | 'sent' | 'error'

export default function SignInModal({ onClose }: SignInModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string>()
  const [infoMessage, setInfoMessage] = useState<string>()

  const emailRedirectTo = useMemo(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin.replace(/\/$/, '')
      const nextPath = `${window.location.pathname}${window.location.search}`
      return buildSignInRedirectUrl(origin, nextPath)
    }

    const fallbackOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
    const origin = fallbackOrigin || 'https://interventionalpulm.org'
    return buildSignInRedirectUrl(origin, '/dashboard')
  }, [])

  const passwordResetRedirectTo = useMemo(() => {
    if (typeof window !== 'undefined') {
      return buildLocalSupabaseRedirectUrl(window.location.origin, '/auth/update-password')
    }

    const fallbackOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
    const origin = fallbackOrigin || 'https://interventionalpulm.org'
    return buildLocalSupabaseRedirectUrl(origin, '/auth/update-password')
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setStatus('submitting')
    setError(undefined)
    setInfoMessage(undefined)

    const supabase = supabaseCookieBrowser()

    if (mode === 'sign-in') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setStatus('error')
        setError(signInError.message)
        return
      }

      router.refresh()
      onClose()
      return
    }

    if (mode === 'reset-password') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: passwordResetRedirectTo,
      })

      if (resetError) {
        setStatus('error')
        setError(resetError.message)
        return
      }

      setStatus('sent')
      setInfoMessage(
        'Password reset email sent. Open the link from this browser to finish resetting your password locally.',
      )
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    })

    if (signUpError) {
      setStatus('error')
      setError(signUpError.message)
      return
    }

    if (data.session) {
      router.refresh()
      onClose()
      return
    }

    setStatus('sent')
    setInfoMessage('Account created. Check your email if Supabase confirmation is still enabled.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Sign in</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign-in modal"
            className="rounded-full border border-transparent p-1 text-lg leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('sign-in')
              setStatus('idle')
              setError(undefined)
              setInfoMessage(undefined)
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              mode === 'sign-in'
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('create-account')
              setStatus('idle')
              setError(undefined)
              setInfoMessage(undefined)
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              mode === 'create-account'
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground'
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('reset-password')
              setStatus('idle')
              setError(undefined)
              setInfoMessage(undefined)
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              mode === 'reset-password'
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground'
            }`}
          >
            Forgot password
          </button>
        </div>

        {status === 'sent' ? (
          <p className="mt-4 text-sm text-muted-foreground">{infoMessage}</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <label className="block text-sm font-medium">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="mt-1 w-full rounded border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            {mode !== 'reset-password' ? (
              <label className="block text-sm font-medium">
                Password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  className="mt-1 w-full rounded border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {mode === 'sign-in'
                ? 'Use the password attached to your Supabase account. This avoids the magic-link redirect flow during local development.'
                : mode === 'reset-password'
                  ? 'Sends a recovery link that should return to the local password reset page instead of the live site.'
                  : 'Creates a password-based account. If email confirmation is enabled in Supabase, you may still receive a confirmation email.'}
            </p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === 'submitting'
                ? mode === 'sign-in'
                  ? 'Signing in...'
                  : mode === 'reset-password'
                    ? 'Sending reset email...'
                    : 'Creating account...'
                : mode === 'sign-in'
                  ? 'Sign in with password'
                  : mode === 'reset-password'
                    ? 'Send reset email'
                    : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
