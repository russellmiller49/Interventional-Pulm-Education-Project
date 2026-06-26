import Link from 'next/link'
import type { Route } from 'next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { EmbeddedTrainingModule } from '@/data/ebus-training'
import { getEmbeddedCourseModuleSrc } from '@/data/ebus-training'
import { HandoffContent } from '@/i18n/handoff'

interface EmbeddedTrainingModuleFrameProps {
  module: EmbeddedTrainingModule
  backHref?: string
  backLabel?: string
  locale: string
}

export function EmbeddedTrainingModuleFrame({
  backHref,
  backLabel,
  locale,
  module,
}: EmbeddedTrainingModuleFrameProps) {
  const embedSrc = getEmbeddedCourseModuleSrc(module, locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-12 py-16">
          <section className="container space-y-6">
            <div className="max-w-4xl space-y-3">
              <Badge
                variant="info"
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              >
                {module.kicker}
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{module.title}</h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                {module.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={embedSrc} target="_blank" rel="noreferrer">
                  Open Dedicated View
                </a>
              </Button>
              {backHref && backLabel ? (
                <Button asChild variant="secondary">
                  <Link href={backHref as Route}>{backLabel}</Link>
                </Button>
              ) : null}
            </div>

            <div className="rounded-lg border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold text-foreground">What&apos;s inside</h2>
              <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                {module.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="container">
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm">
              <iframe
                title={module.title}
                src={embedSrc}
                suppressHydrationWarning
                className="h-[calc(100vh-10rem)] min-h-[820px] w-full bg-slate-950"
              />
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
