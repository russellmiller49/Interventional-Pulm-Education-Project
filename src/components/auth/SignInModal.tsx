'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { supabaseCookieBrowser } from '@/lib/supabase/browser'

interface SignInModalProps {
  onClose: () => void
}

type Status = 'idle' | 'submitting' | 'error'

export default function SignInModal({ onClose }: SignInModalProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string>()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setStatus('submitting')
    setError(undefined)

    let supabase: ReturnType<typeof supabaseCookieBrowser>

    try {
      supabase = supabaseCookieBrowser()
    } catch (configError) {
      setStatus('error')
      setError(
        configError instanceof Error
          ? configError.message
          : 'Sign-in is not available because Supabase public config is missing.',
      )
      return
    }

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
          <label className="block text-sm font-medium">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              autoComplete="current-password"
              className="mt-1 w-full rounded border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <p className="text-sm text-muted-foreground">
            New accounts and password resets use the dedicated site auth flow so profile data and
            permissions stay separate from course and app databases.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === 'submitting' ? 'Signing in...' : 'Sign in with password'}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link
            href={'/signup' as Route}
            onClick={onClose}
            className="font-medium text-primary underline"
          >
            Create free account
          </Link>
          <Link
            href={'/forgot-password' as Route}
            onClick={onClose}
            className="font-medium text-primary underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  )
}
