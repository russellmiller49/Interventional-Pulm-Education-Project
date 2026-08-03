'use client'

import { useMemo, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseCookieBrowser } from '@/lib/supabase/browser'
import { buildSignInRedirectUrl } from '@/lib/supabase/auth-redirect'
import { HandoffContent } from '@/i18n/handoff'

type SubmitStatus = 'idle' | 'submitting' | 'sent' | 'error'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [message, setMessage] = useState<string>()

  const redirectTo = useMemo(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    return buildSignInRedirectUrl(window.location.origin, '/auth/update-password')
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setMessage(undefined)

    try {
      const supabase = supabaseCookieBrowser()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) {
        setStatus('error')
        setMessage(error.message)
        return
      }

      setStatus('sent')
      setMessage('Check your email for a password reset link.')
    } catch (configError) {
      setStatus('error')
      setMessage(
        configError instanceof Error
          ? configError.message
          : 'Password reset is not available because Supabase is not configured.',
      )
    }
  }

  return (
    <HandoffContent>
      {
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block space-y-2 text-sm font-medium">
            <span>Email</span>
            <Input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          {message ? (
            <p
              className={
                status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
              }
            >
              {message}
            </p>
          ) : null}
          <Button type="submit" disabled={status === 'submitting'} className="w-full">
            {status === 'submitting' ? 'Sending reset link...' : 'Send reset link'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link
              href={'/login' as Route}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      }
    </HandoffContent>
  )
}
