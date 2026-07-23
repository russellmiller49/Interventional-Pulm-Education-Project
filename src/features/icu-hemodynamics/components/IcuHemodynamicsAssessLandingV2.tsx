import type { Route } from 'next'
import { ArrowRight, ShieldCheck } from 'lucide-react'

import { Link } from '@/i18n/navigation'

export function IcuHemodynamicsAssessLandingV2() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Assessment</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Case-based capstone</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        The hemodynamics assessment is a masked simulation, not a page-visit or quiz completion. It
        uses a deterministic unseen seed and records mastery only when the preserved score is at
        least 80% with no critical safety error.
      </p>
      <section
        className="mt-8 rounded-3xl border bg-card p-6 shadow-sm"
        aria-label="Assessment status"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Masked capstone boundary</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Masked feedback, the existing 80% mastery rule, and the no-critical-error requirement
              are retained. Opening the route never awards completion, and detailed simulation state
              remains local.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={'/icu-hemodynamics/assess?start=1' as Route}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Start capstone <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="size-4" aria-hidden="true" /> Existing clinical scoring is
                authoritative
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
