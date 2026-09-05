'use client'

import { ArrowRight, BookOpenCheck, GraduationCap } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import { presentationTitle } from '../content/casePresentation'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import {
  ecmoPathwayGroups,
  ecmoWorkedSectionIds,
  nextIncompleteSectionLink,
  type EcmoPathwayGroup,
} from '../content/pathwayResolver'
import type { ProgressV2, SupportMode } from '../engine/types'
import styles from './cardiohelp-ecmo.module.css'
import { useStoredProgress } from './useStoredProgress'

/**
 * One map of the track, shared by the hub and the Learn landing.
 *
 * Seven units, each a native `<details>`; only the unit holding the learner's next section opens
 * on load, so a fresh learner sees seven headings and one open run rather than seventeen chips at
 * once. Every count in a summary is derived from the registries. Section chips carry the worked
 * state in words as well as in state, and case chips name the presentation, never the diagnosis.
 *
 * This is a view of the one sequence, not a second one: flattening the groups reproduces the
 * pathway (`pathway-resolver.test.ts`), and the "Up next" chip is the same section the Continue
 * call to action resolves to.
 */
export function EcmoPathwayAccordion({
  track,
  progress,
  id,
}: {
  readonly track: SupportMode
  readonly progress: ProgressV2
  readonly id?: string
}) {
  const groups = ecmoPathwayGroups(track)
  const order = criticalCareLearningPathway('cardiohelp-ecmo', track).sections
  const worked = ecmoWorkedSectionIds(progress)
  const completedCases = new Set(progress.completedLabs)
  const next = nextIncompleteSectionLink(track, progress)
  const nextSectionId = next?.section.id ?? null
  const openUnitId =
    groups.find((group) => group.sections.some((section) => section.id === nextSectionId))
      ?.unitId ??
    groups[0]?.unitId ??
    null

  return (
    <ol className={styles.hubUnitList} id={id} data-pathway-accordion data-track={track}>
      {groups.map((group, index) => (
        <li key={group.unitId}>
          <details
            className={group.capstoneScenarioId ? styles.hubCapstoneCard : styles.hubUnitCard}
            open={group.unitId === openUnitId}
            data-unit={group.unitId}
          >
            <summary className={styles.hubUnitSummary}>
              <span aria-hidden="true">{index + 1}</span>
              <span className={styles.hubUnitSummaryText}>
                <strong>{group.title}</strong>
                <small>{summaryLine(group, order)}</small>
              </span>
            </summary>
            <p className={styles.hubUnitBody}>{group.summary}</p>
            <div className={styles.hubChipRow}>
              {group.sections.map((section) => {
                const done = worked.has(section.id)
                const isNext = section.id === nextSectionId
                return (
                  <Link
                    key={section.id}
                    className={styles.hubChip}
                    data-kind="section"
                    data-complete={done}
                    data-recommended={isNext}
                    href={{
                      pathname: `${cardiohelpEcmoNavBase}/learn`,
                      query: { lesson: section.id, track },
                    }}
                  >
                    <GraduationCap aria-hidden="true" />
                    {section.title}
                    {done ? ' ✓ worked through' : ''}
                    {isNext ? <em>Up next</em> : null}
                  </Link>
                )
              })}
              {group.caseScenarioIds.map((caseId) => {
                const definition = clinicalPracticeScenarioById.get(caseId)
                const done = completedCases.has(caseId)
                return (
                  <Link
                    key={caseId}
                    className={styles.hubChip}
                    data-kind="case"
                    data-complete={done}
                    href={{
                      pathname: `${cardiohelpEcmoNavBase}/practice`,
                      query: { case: caseId, track },
                    }}
                  >
                    <BookOpenCheck aria-hidden="true" />
                    Case · {definition ? presentationTitle(definition) : 'a case in this unit'}
                    {done ? ' ✓ worked through' : ''}
                  </Link>
                )
              })}
              {group.capstoneScenarioId ? (
                <Link
                  className={styles.hubChip}
                  data-kind="capstone"
                  data-complete={completedCases.has(group.capstoneScenarioId)}
                  href={{ pathname: `${cardiohelpEcmoNavBase}/assess`, query: { track } }}
                >
                  <ArrowRight aria-hidden="true" /> Open the {track.toUpperCase()} challenge
                  {completedCases.has(group.capstoneScenarioId) ? ' ✓ worked through' : ''}
                </Link>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ol>
  )
}

/** "Sections 1–6 · 6 sections · 1 case · 56 min", every number counted from the registries. */
export function summaryLine(
  group: EcmoPathwayGroup,
  order: readonly { readonly id: string; readonly minutes: number }[],
): string {
  const positions = group.sections.map(
    (section) => order.findIndex((candidate) => candidate.id === section.id) + 1,
  )
  const minutes = group.sections.reduce((total, section) => total + section.minutes, 0)
  const first = Math.min(...positions)
  const last = Math.max(...positions)
  const span =
    positions.length === 0
      ? 'No sections'
      : first === last
        ? `Section ${first}`
        : `Sections ${first}–${last}`
  const sectionCount = `${group.sections.length} section${group.sections.length === 1 ? '' : 's'}`
  const caseCount =
    group.caseScenarioIds.length > 0
      ? `${group.caseScenarioIds.length} case${group.caseScenarioIds.length === 1 ? '' : 's'}`
      : group.capstoneScenarioId
        ? 'the challenge'
        : null
  return [span, sectionCount, caseCount, `${minutes} min`].filter(Boolean).join(' · ')
}

/**
 * The accordion over the learner's stored progress, for surfaces that hold no progress state of
 * their own (the Learn landing is a server component). Hydration-safe: the server pass and the
 * first client render both see a fresh envelope, so the same unit opens on both.
 */
export function EcmoStoredPathwayAccordion({
  track,
  id,
}: {
  readonly track: SupportMode
  readonly id?: string
}) {
  const { progress, hydrated } = useStoredProgress()
  return (
    <div data-hydrated={hydrated}>
      <EcmoPathwayAccordion track={track} progress={progress} id={id} />
    </div>
  )
}
