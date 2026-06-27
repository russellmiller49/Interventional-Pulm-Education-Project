'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isActiveLocale } from '@/i18n/locale'
import { localizePath } from '@/i18n/path'
import { normalizePostAuthNextPath } from '@/lib/site-auth/auth-next-path'
import { redirectToPostLoginPath } from '@/lib/site-auth/post-login-redirect'
import { supabaseCookieBrowser } from '@/lib/supabase/browser'

import { AuthFooterLink } from './AuthShell'

type SubmitStatus = 'idle' | 'submitting' | 'redirecting' | 'error'

export function LoginForm() {
  const locale = useLocale()
  const activeLocale = isActiveLocale(locale) ? locale : 'en'
  const t = useTranslations('auth.login')
  const searchParams = useSearchParams()
  const nextPath = useMemo(
    () => normalizePostAuthNextPath(searchParams.get('next'), activeLocale),
    [activeLocale, searchParams],
  )
  const forgotPasswordHref = localizePath('/forgot-password', activeLocale) as Route
  const signupHref = localizePath('/signup', activeLocale) as Route
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
      setError(configError instanceof Error ? configError.message : t('errors.unavailable'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block space-y-2 text-sm font-medium">
        <span>{t('emailLabel')}</span>
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
        <span>{t('passwordLabel')}</span>
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
          href={forgotPasswordHref}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('forgotPassword')}
        </Link>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        disabled={status === 'submitting' || status === 'redirecting'}
        className="w-full"
      >
        {status === 'submitting'
          ? t('submitting')
          : status === 'redirecting'
            ? t('redirecting')
            : t('submit')}
      </Button>
      <AuthFooterLink href={signupHref} text={t('footerText')} label={t('footerLabel')} />
    </form>
  )
}
