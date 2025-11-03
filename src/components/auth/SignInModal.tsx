'use client'

import { useMemo, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/browser'

interface SignInModalProps {
  onClose: () => void
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function SignInModal({ onClose }: SignInModalProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string>()

  const emailRedirectTo = useMemo(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin.replace(/\/$/, '')
      return `${origin}/auth/callback`
    }

    const fallbackOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
    const origin = fallbackOrigin || 'https://interventionalpulm.org'
    return `${origin}/auth/callback`
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setStatus('sending')
    setError(undefined)

    const supabase = supabaseBrowser()
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
      },
    })

    if (signInError) {
      setStatus('error')
      setError(signInError.message)
      return
    }

    setStatus('sent')
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

        {status === 'sent' ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Check your email for a sign-in link or one-time code to finish logging in.
          </p>
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
                className="mt-1 w-full rounded border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === 'sending' ? 'Sending...' : 'Send magic link / OTP'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
