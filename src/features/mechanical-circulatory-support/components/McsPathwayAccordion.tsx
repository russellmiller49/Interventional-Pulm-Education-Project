'use client'

import { useEffect, useState } from 'react'

import { Link } from '@/i18n/navigation'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import { mcsCaseKindLabel, mcsPresentationTitle } from '../content/casePresentation'
import {
  mcsGroupSummaryLine,
  mcsLearnSectionHref,
  mcsPathwayGroups,
  mcsWorkedSectionIds,
  resolveNextIncompleteMcsSection,
  type McsProgressView,
} from '../content/pathwayResolver'
import { mcsSectionCase } from '../content/sectionSpecs'
import { readMcsLearningProgress } from '../engine/learningProgress'
import styles from './mechanical-circulatory-support.module.css'

const FRESH_PROGRESS: McsProgressView = { visitedLessonIds: [], visitedCaseIds: [] }

/**
 * The one map: the pathway as its five groups, each a disclosure, the one holding the learner's
 * next section open.
 *
 * Groups are contiguous runs of the canonical order, so opening every group and reading top to
 * bottom is the pathway. Section chips say "worked through" in words rather than only in an
 * attribute. A section that ends on a case names it on its own chip as its last task: the case runs
 * inside the section, so it is part of the section rather than a separate link to Practice. The
 * unit's other cases keep their chips, which open Practice.
 */
export function McsPathwayAccordion({
  progress,
  id = 'mcs-pathway',
}: {
  readonly progress: McsProgressView
  readonly id?: string
}) {
  const groups = mcsPathwayGroups()
  const worked = mcsWorkedSectionIds(progress)
  const visited = new Set(progress.visitedCaseIds)
  const next = resolveNextIncompleteMcsSection(progress)
  const placedCaseIds = new Set(
    groups.flatMap((group) =>
      group.sections.flatMap((section) => mcsSectionCase(section.id)?.caseId ?? []),
    ),
  )

  return (
    <div className={styles.pathwayAccordion} id={id} data-pathway-accordion>
      {groups.map((group, index) => {
        const holdsNext = next !== null && group.sections.some((section) => section.id === next.id)
        return (
          <details
            key={group.id}
            className={styles.pathwayGroup}
            open={holdsNext || (next === null && index === 0)}
            data-unit={group.id}
            data-holds-next={holdsNext || undefined}
          >
            <summary>
              <span className={styles.pathwayGroupTitle}>{group.title}</span>
              <span className={styles.pathwayGroupLine}>{mcsGroupSummaryLine(group)}</span>
            </summary>
            <ol className={styles.pathwayChips}>
              {group.sections.map((section) => {
                const done = worked.has(section.id)
                const recommended = next?.id === section.id
                const sectionCase = mcsSectionCase(section.id)
                return (
                  <li
                    key={section.id}
                    data-kind="section"
                    data-visited={done}
                    data-recommended={recommended || undefined}
                  >
                    <Link href={mcsLearnSectionHref(section.id)}>
                      <span className={styles.pathwayChipKicker}>
                        Section {sectionNumber(section.id)} · {section.minutes} min
                        {recommended ? ' · up next' : ''}
                      </span>
                      <span className={styles.pathwayChipTitle}>{section.title}</span>
                      <span className={styles.pathwayChipDescription}>{section.description}</span>
                      {sectionCase ? (
                        <span
                          className={styles.pathwayChipDescription}
                          data-section-case={sectionCase.caseId}
                        >
                          Last task · Case: {sectionCase.title}
                        </span>
                      ) : null}
                      {done ? <span className={styles.pathwayChipDone}>visited</span> : null}
                    </Link>
                  </li>
                )
              })}
              {group.cases
                .filter((scenario) => !placedCaseIds.has(scenario.id))
                .map((scenario) => (
                  <li key={scenario.id} data-kind="case" data-visited={visited.has(scenario.id)}>
                    <Link
                      href={`${mechanicalCirculatorySupportNavBase}/practice?case=${encodeURIComponent(scenario.id)}`}
                    >
                      <span className={styles.pathwayChipKicker}>{mcsCaseKindLabel(scenario)}</span>
                      <span className={styles.pathwayChipTitle}>
                        {mcsPresentationTitle(scenario)}
                      </span>
                      {visited.has(scenario.id) ? (
                        <span className={styles.pathwayChipDone}>visited</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              {group.capstone ? (
                <li data-kind="capstone" data-visited={visited.has(group.capstone.id)}>
                  <Link
                    href={`${mechanicalCirculatorySupportNavBase}/assess?case=${encodeURIComponent(group.capstone.id)}`}
                  >
                    <span className={styles.pathwayChipKicker}>
                      {mcsCaseKindLabel(group.capstone)}
                    </span>
                    <span className={styles.pathwayChipTitle}>
                      {mcsPresentationTitle(group.capstone)}
                    </span>
                  </Link>
                </li>
              ) : null}
            </ol>
          </details>
        )
      })}
    </div>
  )
}

function sectionNumber(sectionId: string): number {
  let ordinal = 0
  for (const group of mcsPathwayGroups()) {
    for (const section of group.sections) {
      ordinal += 1
      if (section.id === sectionId) return ordinal
    }
  }
  return ordinal
}

/**
 * The accordion over stored progress, for server-component hosts.
 *
 * Renders the fresh-learner map on the server and on the first client pass, then reads the stored
 * envelope; the two renders differ only in which group is open and which chips are marked.
 */
export function McsStoredPathwayAccordion({ id }: { readonly id?: string }) {
  const [progress, setProgress] = useState<McsProgressView>(FRESH_PROGRESS)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProgress(readMcsLearningProgress())
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div data-hydrated={hydrated}>
      <McsPathwayAccordion progress={progress} id={id} />
    </div>
  )
}
