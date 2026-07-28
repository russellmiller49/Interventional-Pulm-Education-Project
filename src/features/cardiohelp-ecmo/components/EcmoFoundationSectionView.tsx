import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { HeldDisagreement } from '@/features/critical-care/components/teaching/EvidenceRenderers'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'
import {
  nextPathwaySection,
  pathwaySectionIndex,
} from '@/features/learning-module/curriculum/types'
import { Link } from '@/i18n/navigation'

import type { SupportMode } from '../engine/types'
import { ecmoFoundationSectionById } from '../content/foundationLessons'

/**
 * Renders an authored physiology section. These sections carry prose rather than a simulator
 * walkthrough — the drill player cannot teach the circuit it already assumes.
 */
export function EcmoFoundationSectionView({
  sectionId,
  supportMode,
}: {
  readonly sectionId: string
  readonly supportMode: SupportMode
}) {
  const section = ecmoFoundationSectionById.get(sectionId)
  if (!section) return null

  const pathway = criticalCareLearningPathway('cardiohelp-ecmo', supportMode)
  const index = pathwaySectionIndex(pathway, sectionId)
  const next = nextPathwaySection(pathway, sectionId)
  // Held open on purpose: the supplied ECMO synthesis reports no universally endorsed adult
  // target set, so both source-stated ranges stay visible and neither becomes a threshold here.
  const conflict = section.heldDisagreementId
    ? criticalCareSourceConflictById.get(section.heldDisagreementId)
    : undefined

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
        {supportMode.toUpperCase()} pathway · Section {index + 1} of {pathway.sections.length}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{section.title}</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">{section.summary}</p>

      <div className="mt-8 grid gap-4">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph} className="max-w-3xl leading-7">
            {paragraph}
          </p>
        ))}
      </div>

      {section.bullets ? (
        <ul className="mt-6 grid max-w-3xl gap-2 text-sm leading-6">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="rounded-xl border bg-card px-4 py-3">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}

      {conflict ? <HeldDisagreement conflict={conflict} headingLevel={2} /> : null}

      <aside className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-6">
        <strong>Educational resource.</strong> Device behavior, measurements, and modeled responses
        depend on patient context, device revision, current manufacturer instructions, local policy,
        and clinical judgement.
      </aside>

      {next ? (
        <Link
          href={`/cardiohelp-ecmo/learn?lesson=${next.id}&track=${supportMode}` as Route}
          className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Continue to next section: {next.title}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </main>
  )
}
