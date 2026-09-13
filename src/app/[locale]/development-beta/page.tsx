import Link from 'next/link'
import type { Route } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { ArrowUpRight, MessageSquare, FlaskConical } from 'lucide-react'
import { betaModules } from '@/features/module-beta/catalog'

export default async function BetaHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <div className="container max-w-6xl space-y-10 py-10 md:py-16">
      <header className="max-w-3xl space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <FlaskConical className="h-5 w-5" aria-hidden /> Development · Beta testing
        </p>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Help shape the next modules
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Explore a module and share what worked, what was confusing, or what needs fixing. Your
          site account identifies your feedback for the review team.
        </p>
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4 text-sm leading-6">
          <MessageSquare className="mt-1 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Choose <strong>Test with feedback</strong> to open a module with a feedback button. Add
            a comment, quote selected text, or attach and highlight an image. These development
            modules may change.
          </p>
        </div>
      </header>
      {['Bronchoscopy', 'Devices', 'Critical care'].map((group) => (
        <section key={group} className="space-y-4">
          <h2 className="text-2xl font-semibold">{group}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {betaModules
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <article
                  key={entry.id}
                  className="flex flex-col justify-between gap-6 rounded-2xl border bg-card p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold">{entry.title}</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      href={`/${locale}/development-beta/${entry.id}` as Route}
                    >
                      Test with feedback <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      className="text-sm underline underline-offset-4"
                      href={`/${locale}${entry.path}` as Route}
                    >
                      Standard module
                    </Link>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
