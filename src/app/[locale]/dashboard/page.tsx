import type { Route } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { supabaseServer } from '@/lib/supabase/server'

interface DashboardPageProps {
  params: Promise<{
    locale: string
  }>
  searchParams?: Promise<{
    required?: string
  }>
}

const requiredAccessLabelKeys: Record<string, 'ipRegistry' | 'socalEbusCourse'> = {
  ip_registry: 'ipRegistry',
  socal_ebus_course: 'socalEbusCourse',
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('dashboard')
  const query = await searchParams
  const requiredAccess = query?.required
    ? t(`requiredAccess.${requiredAccessLabelKeys[query.required] ?? 'fallback'}`)
    : null
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col justify-center gap-6 pb-16 pt-24">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="text-muted-foreground">
          {user
            ? t('signedInAs', { email: user.email ?? t('authenticatedUser') })
            : t('sessionNotDetected')}
        </p>
        {requiredAccess ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
            {t('permissionRequired', { access: requiredAccess })}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Link
            href={'/resources' as Route}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t('exploreResources')}
          </Link>
          <Link
            href={'/coming-soon' as Route}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t('seeComingSoon')}
          </Link>
        </div>
      </div>
    </div>
  )
}
