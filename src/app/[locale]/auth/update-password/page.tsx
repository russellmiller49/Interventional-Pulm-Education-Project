'use client'

import { useEffect, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { supabaseCookieBrowser } from '@/lib/supabase/browser'

type RecoveryStatus = 'checking' | 'ready' | 'submitting' | 'success' | 'error'

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'The password recovery link is invalid or expired.'
}

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<RecoveryStatus>('checking')
  const [message, setMessage] = useState<string>('Checking the password recovery session...')

  useEffect(() => {
    const supabase = supabaseCookieBrowser()
    let isActive = true

    async function loadRecoverySession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (!isActive) {
          return
        }

        if (error) {
          throw error
        }

        if (!session) {
          setStatus('error')
          setMessage(
            'No recovery session was found. Request a new reset email and open it from this browser.',
          )
          return
        }

        setStatus('ready')
        setMessage('Choose a new password for your Supabase account.')
      } catch (error) {
        if (!isActive) {
          return
        }

        setStatus('error')
        setMessage(formatErrorMessage(error))
      }
    }

    void loadRecoverySession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!isActive) {
        return
      }

      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setStatus(session ? 'ready' : 'error')
        setMessage(
          session
            ? 'Choose a new password for your Supabase account.'
            : 'No recovery session was found. Request a new reset email and open it from this browser.',
        )
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < 8) {
      setStatus('error')
      setMessage('Use a password that is at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('The password confirmation does not match.')
      return
    }

    setStatus('submitting')
    setMessage('Updating your password...')

    const supabase = supabaseCookieBrowser()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('success')
    setMessage('Password updated. Redirecting to sign in...')

    window.setTimeout(() => {
      router.replace('/login' as Route)
      router.refresh()
    }, 800)
  }

  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center gap-6 pb-16 pt-24">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">Update password</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>

      {status === 'ready' || status === 'submitting' ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <label className="block text-sm font-medium">
            New password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm password
            <input
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === 'submitting' ? 'Updating password...' : 'Save new password'}
          </button>
        </form>
      ) : null}

      {status === 'error' ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <p className="text-sm text-muted-foreground">
            Request another reset email, then open the link from the same browser.
          </p>
        </div>
      ) : null}

      <div>
        <Link
          href={'/login' as Route}
          className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
