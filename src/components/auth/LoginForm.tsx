'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { redirectToPostLoginPath } from '@/lib/site-auth/post-login-redirect'
import { supabaseCookieBrowser } from '@/lib/supabase/browser'

import { AuthFooterLink } from './AuthShell'

type SubmitStatus = 'idle' | 'submitting' | 'redirecting' | 'error'

const DEFAULT_NEXT_PATH = '/dashboard'
const AUTH_DESTINATION_PATHS = new Set([
  '/auth/update-password',
  '/forgot-password',
  '/login',
  '/signup',
  '/verify-email',
])

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_NEXT_PATH
  }

  try {
    const target = new URL(value, 'https://interventionalpulm.local')

    if (
      AUTH_DESTINATION_PATHS.has(target.pathname) ||
      target.pathname.startsWith('/auth/callback')
    ) {
      return DEFAULT_NEXT_PATH
    }

    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return DEFAULT_NEXT_PATH
  }
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const nextPath = useMemo(() => normalizeNextPath(searchParams.get('next')), [searchParams])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true

    async function redirectIfAlreadySignedIn() {
      let supabase: ReturnType<typeof supabaseCookieBrowser>

      try {
        supabase = supabaseCookieBrowser()
      } catch {
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (active && user) {
        redirectToPostLoginPath(nextPath)
      }
    }

    void redirectIfAlreadySignedIn()

    return () => {
      active = false
    }
  }, [nextPath])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setError(undefined)

    try {
      const supabase = supabaseCookieBrowser()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setStatus('error')
        setError(signInError.message)
        return
      }

      setStatus('redirecting')
      redirectToPostLoginPath(nextPath)
    } catch (configError) {
      setStatus('error')
      setError(
        configError instanceof Error
          ? configError.message
          : 'Sign-in is not available because Supabase is not configured.',
      )
    }
  }

  return (
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
      <label className="block space-y-2 text-sm font-medium">
        <span>Password</span>
        <Input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          minLength={8}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={'/forgot-password' as Route}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        disabled={status === 'submitting' || status === 'redirecting'}
        className="w-full"
      >
        {status === 'submitting'
          ? 'Signing in...'
          : status === 'redirecting'
            ? 'Redirecting...'
            : 'Sign in'}
      </Button>
      <AuthFooterLink href={'/signup' as Route} text="Need an account?" label="Sign up for free" />
    </form>
  )
}
