import Link from 'next/link'
import type { Route } from 'next'

import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
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
        <div className={simulatorPage.root}>
          {/* A multi-pane workspace spans the window; a reading module keeps the page's column. */}
          <section
            className={module.frame === 'wide' ? simulatorPage.stage : 'container space-y-2'}
          >
            <div className={simulatorPage.header}>
              <div className={simulatorPage.identity}>
                <Badge
                  variant="info"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  {module.kicker}
                </Badge>
                <h1 className={simulatorPage.title}>{module.title}</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  What&apos;s inside
                </a>
                <Button asChild size="sm">
                  <a href={embedSrc} target="_blank" rel="noreferrer">
                    Open Dedicated View
                  </a>
                </Button>
                {backHref && backLabel ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={backHref as Route}>{backLabel}</Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className={simulatorPage.frame}>
              <iframe
                title={module.title}
                src={embedSrc}
                suppressHydrationWarning
                className={`${simulatorPage.iframe} bg-background`}
              />
            </div>
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              {module.description}
            </p>

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
        </div>
      }
    </HandoffContent>
  )
}
