'use client'

import { ArrowRight } from 'lucide-react'

import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import {
  nextSelfPacedVentilationSection,
  ventilationCompositionLine,
  ventilationPathwayComposition,
} from '../content/pathwayResolver'
import { MechanicalVentilationModuleFrame } from './MechanicalVentilationModuleFrame'
import { VentilationPathwayAccordion } from './VentilationPathwayAccordion'
import styles from './mechanical-ventilation-hub.module.css'
import { useVentilationSelfPacedProgress } from './useVentilationSelfPacedProgress'

/**
 * The Learn landing: the same door and the same map as the hub, without the rest of the hub.
 * The Continue resolves through the same function, so the two surfaces cannot disagree.
 */
export function MechanicalVentilationLearnLanding({
  locale = 'en',
  unknownActivity,
}: {
  readonly locale?: string
  readonly unknownActivity?: string
}) {
  const { progress, ready } = useVentilationSelfPacedProgress()
  const next = nextSelfPacedVentilationSection(progress)
  const composition = ventilationPathwayComposition()
  const visitedCases = new Set(progress.visited)

  return (
    <MechanicalVentilationModuleFrame
      locale={locale}
      activeHref={`${mechanicalVentilationNavBase}/learn`}
    >
      <div data-hydrated={ready}>
        {unknownActivity ? (
          <p className={styles.note} role="status" data-unknown-activity>
            The requested section is not in this content version. Choose one of the sections below.
          </p>
        ) : null}
        <header className={styles.hero}>
          <h1>Learn</h1>
          <p>
            {composition.total} sections in one order. The first five teach the concept with a
            worked reference before you apply it, capture a breath or run an experiment, and
            interpret the result. Later sections build on those skills with clinical cases. The
            order is a recommendation; every section is available from the start.
          </p>
          <div className={styles.entryActions}>
            {next ? (
              <Link
                className={styles.continue}
                data-ventilation-continue={ready ? 'resolved' : 'pending'}
                href={next.href}
              >
                <ArrowRight aria-hidden="true" />
                <span>
                  <strong>
                    {next.inProgress ? 'Resume' : 'Continue'} — {next.unit.title}
                  </strong>
                  <small>
                    Section {next.index + 1} of {composition.total} · {next.unit.minutes} minutes
                  </small>
                </span>
              </Link>
            ) : (
              <p className={styles.done} data-ventilation-continue="complete">
                Revisit any section below.
              </p>
            )}
          </div>
          <p className={styles.composition}>{ventilationCompositionLine()}</p>
        </header>
        <section className={styles.section} aria-labelledby="mv-learn-pathway">
          <div className={styles.sectionHeading}>
            <h2 id="mv-learn-pathway">All {composition.total} sections</h2>
            <span>Grouped by stage · one order</span>
          </div>
          <VentilationPathwayAccordion progress={progress} visitedCaseIds={visitedCases} />
        </section>
      </div>
    </MechanicalVentilationModuleFrame>
  )
}
