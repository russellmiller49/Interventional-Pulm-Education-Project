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
import { readMcsProgress } from '../engine'
import styles from './mechanical-circulatory-support.module.css'

const FRESH_PROGRESS: McsProgressView = { completedLessonIds: [], masteredCaseIds: [] }

/**
 * The one map: the pathway as its five groups, each a disclosure, the one holding the learner's
 * next section open.
 *
 * Groups are contiguous runs of the canonical order, so opening every group and reading top to
 * bottom is the pathway. Section chips say "worked through" in words rather than only in an
 * attribute; case chips are named by presentation, never by diagnosis, because the accordion is
 * read before any case's debrief.
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
  const mastered = new Set(progress.masteredCaseIds)
  const next = resolveNextIncompleteMcsSection(progress)

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
                return (
                  <li
                    key={section.id}
                    data-kind="section"
                    data-complete={done}
                    data-recommended={recommended || undefined}
                  >
                    <Link href={mcsLearnSectionHref(section.id)}>
                      <span className={styles.pathwayChipKicker}>
                        Section {sectionNumber(section.id)} · {section.minutes} min
                        {recommended ? ' · up next' : ''}
                      </span>
                      <span className={styles.pathwayChipTitle}>{section.title}</span>
                      <span className={styles.pathwayChipDescription}>{section.description}</span>
                      {done ? (
                        <span className={styles.pathwayChipDone}>✓ worked through</span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
              {group.cases.map((scenario) => (
                <li key={scenario.id} data-kind="case" data-complete={mastered.has(scenario.id)}>
                  <Link
                    href={`${mechanicalCirculatorySupportNavBase}/practice?case=${encodeURIComponent(scenario.id)}`}
                  >
                    <span className={styles.pathwayChipKicker}>{mcsCaseKindLabel(scenario)}</span>
                    <span className={styles.pathwayChipTitle}>
                      {mcsPresentationTitle(scenario)}
                    </span>
                    {mastered.has(scenario.id) ? (
                      <span className={styles.pathwayChipDone}>✓ worked through</span>
                    ) : null}
                  </Link>
                </li>
              ))}
              {group.capstone ? (
                <li data-kind="capstone" data-complete={mastered.has(group.capstone.id)}>
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
      setProgress(readMcsProgress())
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
