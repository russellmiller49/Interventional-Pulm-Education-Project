'use client'

import { BookOpenCheck, GraduationCap } from 'lucide-react'

import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { ventilationLearningUnits } from '../content/learningCurriculum'
import {
  nextIncompleteVentilationSection,
  ventilationPathwayGroups,
  workedVentilationSectionIds,
  type VentilationPathwayGroup,
} from '../content/pathwayResolver'
import type { LabProgress } from '../engine/learningLab'
import { readProgress as readCaseProgress } from '../engine/progress'
import styles from './mechanical-ventilation-hub.module.css'
import { useVentilationLabProgress } from './useVentilationLabProgress'

/**
 * One map of the pathway, shared by the hub and the Learn landing.
 *
 * Five groups — the stages — each a native `<details>`; only the group holding the learner's next
 * section opens on load. Every count in a summary is derived from the registry. Section chips carry
 * the worked state in words as well as in state, and case chips name the presentation, never the
 * diagnosis. Flattening the groups reproduces the canonical order, and the "Up next" chip is the
 * same section the Continue call to action resolves to.
 */
export function VentilationPathwayAccordion({
  progress,
  completedCaseIds,
  id,
}: {
  readonly progress: LabProgress
  readonly completedCaseIds: ReadonlySet<string>
  readonly id?: string
}) {
  const groups = ventilationPathwayGroups()
  const worked = workedVentilationSectionIds(progress)
  const next = nextIncompleteVentilationSection(progress)
  const nextId = next?.unit.id ?? null
  const openStage =
    groups.find((group) => group.units.some((unit) => unit.id === nextId))?.stage ??
    groups[0]?.stage ??
    null

  return (
    <ol className={styles.unitList} id={id} data-pathway-accordion>
      {groups.map((group, index) => (
        <li key={group.stage}>
          <details
            className={styles.unitCard}
            open={group.stage === openStage}
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
                    data-complete={done}
                    data-recommended={isNext}
                    href={{
                      pathname: `${mechanicalVentilationNavBase}/learn`,
                      query: { activity: unit.id },
                    }}
                  >
                    <GraduationCap aria-hidden="true" />
                    {unit.title}
                    {done ? ' ✓ worked through' : ''}
                    {isNext ? <em>Up next</em> : null}
                  </Link>
                )
              })}
              {dedupeCases(group.cases).map((entry) => {
                const done = completedCaseIds.has(entry.caseId)
                return (
                  <Link
                    key={entry.caseId}
                    className={styles.chip}
                    data-kind="case"
                    data-complete={done}
                    href={{
                      pathname: `${mechanicalVentilationNavBase}/practice`,
                      query: { case: entry.caseId },
                    }}
                  >
                    <BookOpenCheck aria-hidden="true" />
                    Case · {entry.title}
                    {done ? ' ✓ worked through' : ''}
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

/** "Sections 4–10 · 7 sections · 5 cases · 53 min", every number counted from the registry. */
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
  const caseCount = caseIds.size > 0 ? `${caseIds.size} case${caseIds.size === 1 ? '' : 's'}` : null
  return [span, sectionCount, caseCount, `${minutes} min`].filter(Boolean).join(' · ')
}

/** The accordion over stored progress, for surfaces that hold none of their own. */
export function VentilationStoredPathwayAccordion({ id }: { readonly id?: string }) {
  const { progress, ready } = useVentilationLabProgress()
  const completedCases = ready ? new Set(readCaseProgress().completedCases) : new Set<string>()
  return (
    <div data-hydrated={ready}>
      <VentilationPathwayAccordion progress={progress} completedCaseIds={completedCases} id={id} />
    </div>
  )
}
