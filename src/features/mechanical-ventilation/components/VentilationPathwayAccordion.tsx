'use client'

import { useState } from 'react'
import { BookOpenCheck, GraduationCap } from 'lucide-react'

import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import {
  isVentilationCaseLive,
  ventilationSectionNumber,
  VENTILATION_HELD_CASE_TAG,
} from '../content/learnerMap'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import {
  nextSelfPacedVentilationSection,
  ventilationPathwayGroups,
  type VentilationPathwayGroup,
} from '../content/pathwayResolver'
import type { VentilationSelfPacedProgress } from '../engine/selfPacedProgress'
import styles from './mechanical-ventilation-hub.module.css'
import { useVentilationSelfPacedProgress } from './useVentilationSelfPacedProgress'

/**
 * One map of the pathway, shared by the hub and the Learn landing.
 *
 * Five groups — the stages — each a native `<details>`; only the group holding the learner's next
 * section opens on load. Every count in a summary is derived from the registry. Section chips carry
 * the worked state in words as well as in state, and case chips name the presentation, never the
 * diagnosis. Flattening the groups reproduces the canonical order, and the "Up next" chip is the
 * same section the Continue call to action resolves to.
 *
 * Which group opens, and which chip says "Up next", depend on progress stored on this device, which
 * is read only after the page has hydrated. Both used to be computed from the empty progress the
 * server and the first client render see, and computed again when the stored progress arrived: for a
 * returning learner the first paint opened stage 1 with Section 1 as "Up next", then collapsed it
 * and opened a later stage, so a click aimed at that chip in between landed on nothing and the page
 * jumped (MV-PRE-REVIEW-03 B2, reproduced on the Learn landing). Now nothing opens and no chip is
 * marked until `ready`; the open group is chosen once, when it is, and belongs to the learner after
 * that — a later progress change never collapses a group under the pointer.
 */
export function VentilationPathwayAccordion({
  progress,
  visitedCaseIds,
  id,
  ready = true,
}: {
  readonly progress: VentilationSelfPacedProgress
  readonly visitedCaseIds: ReadonlySet<string>
  readonly id?: string
  /** False until stored progress has been read; see above. */
  readonly ready?: boolean
}) {
  const groups = ventilationPathwayGroups()
  const worked = new Set(progress.visited)
  const next = ready ? nextSelfPacedVentilationSection(progress) : null
  const nextId = next?.unit.id ?? null
  const chosenStage =
    groups.find((group) => group.units.some((unit) => unit.id === nextId))?.stage ??
    groups[0]?.stage ??
    null
  const [openStage, setOpenStage] = useState<string | null | undefined>(
    ready ? chosenStage : undefined,
  )
  if (ready && openStage === undefined) setOpenStage(chosenStage)

  return (
    <ol className={styles.unitList} id={id} data-pathway-accordion>
      {groups.map((group, index) => (
        <li key={group.stage}>
          <details
            className={styles.unitCard}
            open={openStage !== undefined && group.stage === openStage}
            data-unit={group.stage}
            data-stage={group.stage}
          >
            <summary className={styles.unitSummary}>
              <span aria-hidden="true">{index + 1}</span>
              <span className={styles.unitSummaryText}>
                <strong>{group.title}</strong>
                <small>{summaryLine(group)}</small>
              </span>
            </summary>
            <p className={styles.unitBody}>{group.description}</p>
            <div className={styles.chipRow}>
              {group.units.map((unit) => {
                const done = worked.has(unit.id)
                const isNext = unit.id === nextId
                return (
                  <Link
                    key={unit.id}
                    className={styles.chip}
                    data-kind="section"
                    data-visited={done}
                    data-recommended={isNext}
                    href={{
                      pathname: `${mechanicalVentilationNavBase}/learn`,
                      query: { activity: unit.id },
                    }}
                  >
                    <GraduationCap aria-hidden="true" />
                    {ventilationSectionNumber(unit.id)}. {unit.title}
                    {done ? ' · visited' : ''}
                    {isNext ? <em>Up next</em> : null}
                  </Link>
                )
              })}
              {dedupeCases(group.cases).map((entry) => {
                const done = visitedCaseIds.has(entry.caseId)
                return (
                  <Link
                    key={entry.caseId}
                    className={styles.chip}
                    data-kind="case"
                    data-visited={done}
                    href={{
                      pathname: `${mechanicalVentilationNavBase}/practice`,
                      query: { case: entry.caseId },
                    }}
                  >
                    <BookOpenCheck aria-hidden="true" />
                    Case · {entry.title}
                    {isVentilationCaseLive(entry.caseId) ? '' : ` · ${VENTILATION_HELD_CASE_TAG}`}
                    {entry.revisit ? ' · revisit' : ''}
                    {done ? ' · visited' : ''}
                  </Link>
                )
              })}
            </div>
          </details>
        </li>
      ))}
    </ol>
  )
}

function dedupeCases(cases: VentilationPathwayGroup['cases']): VentilationPathwayGroup['cases'] {
  const seen = new Set<string>()
  return cases.filter((entry) => {
    if (seen.has(entry.caseId)) return false
    seen.add(entry.caseId)
    return true
  })
}

/**
 * "Sections 4–10 · 7 sections · 4 paired cases · about 53 min of reading", every number counted
 * from the registry. The case count is the cases paired with this stage's sections, not a share of
 * the whole case set; the Practice page lists every entry.
 */
export function summaryLine(group: VentilationPathwayGroup): string {
  const positions = group.units.map(
    (unit) => ventilationLearningUnits.findIndex((u) => u.id === unit.id) + 1,
  )
  const minutes = group.units.reduce((total, unit) => total + unit.minutes, 0)
  const first = Math.min(...positions)
  const last = Math.max(...positions)
  const span = first === last ? `Section ${first}` : `Sections ${first}–${last}`
  const sectionCount = `${group.units.length} section${group.units.length === 1 ? '' : 's'}`
  const caseIds = new Set(group.cases.map((entry) => entry.caseId))
  const caseCount =
    caseIds.size > 0 ? `${caseIds.size} paired case${caseIds.size === 1 ? '' : 's'}` : null
  return [span, sectionCount, caseCount, `about ${minutes} min of reading`]
    .filter(Boolean)
    .join(' · ')
}

/** The accordion over stored progress, for surfaces that hold none of their own. */
export function VentilationStoredPathwayAccordion({ id }: { readonly id?: string }) {
  const { progress, ready } = useVentilationSelfPacedProgress()
  const visitedCases = new Set(progress.visited)
  return (
    <div data-hydrated={ready}>
      <VentilationPathwayAccordion
        progress={progress}
        visitedCaseIds={visitedCases}
        id={id}
        ready={ready}
      />
    </div>
  )
}
