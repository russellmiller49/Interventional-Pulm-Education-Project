import type { Route } from 'next'
import { ArrowRight, GitCompareArrows } from 'lucide-react'

import { Link } from '@/i18n/navigation'

export function IcuHemodynamicsAssessLandingV2() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Challenge</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">A harder hemodynamics case</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        Work through the HD-07 pressure-equalization scenario with fewer prompts. Teaching feedback
        is collected for the debrief by default, or you can turn on per-action feedback before you
        begin. The challenge is open regardless of saved history.
      </p>
      <section
        className="mt-8 rounded-3xl border bg-card p-6 shadow-sm"
        aria-label="Challenge details"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <GitCompareArrows className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Reason first, then compare</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Capture what you thought was happening before the reveal, reconstruct your decisions,
              compare them with an authored expert path, and choose the point worth revisiting.
              Catastrophic actions are always interrupted and leave the pre-action state intact.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={'/icu-hemodynamics/assess?start=1' as Route}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Open challenge <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <GitCompareArrows className="size-4" aria-hidden="true" /> Full teaching debrief at
                the end
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
