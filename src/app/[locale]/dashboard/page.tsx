import Link from 'next/link'
import type { Route } from 'next'

import { supabaseServer } from '@/lib/supabase/server'

interface DashboardPageProps {
  searchParams?: Promise<{
    required?: string
  }>
}

const requiredAccessLabels: Record<string, string> = {
  ip_registry: 'IP Registry',
  socal_ebus_course: 'SoCal EBUS Course',
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const requiredAccess = params?.required
    ? (requiredAccessLabels[params.required] ?? 'that restricted area')
    : null
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col justify-center gap-6 pb-16 pt-24">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">Welcome back</h1>
        <p className="text-muted-foreground">
          {user
            ? `You are signed in as ${user.email ?? 'an authenticated user'}.`
            : 'Session not detected. If this persists, please sign in again.'}
        </p>
        {requiredAccess ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
            Additional permission is required for {requiredAccess}. Your free account can still
            access the standard education modules.
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Link
            href={'/resources' as Route}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Explore resources
          </Link>
          <Link
            href="/coming-soon"
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            See what’s coming
          </Link>
        </div>
      </div>
    </div>
  )
}
