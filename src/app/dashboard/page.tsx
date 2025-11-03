import Link from 'next/link'

import { supabaseServer } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = supabaseServer()
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
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tools"
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Explore tools
          </Link>
          <Link
            href="/training"
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Find training modules
          </Link>
        </div>
      </div>
    </div>
  )
}
