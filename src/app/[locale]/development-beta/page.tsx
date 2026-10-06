import Link from 'next/link'
import type { Route } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { MessageSquare, FlaskConical } from 'lucide-react'
import { BetaHubSections } from '@/features/module-beta/BetaHubSections'
import { betaRollout } from '@/features/module-beta/rollout'
import { feedbackMode } from '@/features/module-beta/config'
import { betaModules } from '@/features/module-beta/catalog'

export default async function BetaHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const local = feedbackMode() === 'owner-local'
  return (
    <div className="container max-w-6xl space-y-10 py-10 md:py-16">
      <header className="max-w-3xl space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <FlaskConical className="h-5 w-5" aria-hidden />{' '}
          {local ? 'Owner review · saved locally on this browser' : 'Development · Beta testing'}
        </p>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Help shape the next modules
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Explore a module and share what worked, what was confusing, or what needs fixing.{' '}
          {local
            ? 'Owner findings and screenshots stay in this browser. Export them from the feedback workspace for consolidated analysis.'
            : 'Your site account identifies your feedback for the review team.'}
        </p>
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4 text-sm leading-6">
          <MessageSquare className="mt-1 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Choose <strong>Test with feedback</strong> to open a module with a feedback button. Add
            a comment, quote selected text, or attach and highlight an image. These are development
            previews: content may be unfinished or still under faculty review, and nothing here is
            for clinical decisions.
          </p>
        </div>
        {local && (
          <Link
            href={`/${locale}/admin/module-feedback` as Route}
            className="inline-block underline"
          >
            Review and export owner feedback
          </Link>
        )}
      </header>
      <BetaHubSections locale={locale} modules={betaModules} rollout={betaRollout} />
    </div>
  )
}
