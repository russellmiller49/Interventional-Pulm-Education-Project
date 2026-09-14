'use client'

import { ArrowRight, BookOpenCheck, GraduationCap } from 'lucide-react'

import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import {
  hemodynamicsPathwayGroups,
  hemodynamicsPathwaySections,
  hemodynamicsSectionLinkTarget,
  reviewedHemodynamicsSectionIds,
  suggestedHemodynamicsSection,
  type HemodynamicsPathwayGroup,
} from '../content/pathwayResolver'
import { isSectionVisited, type IcuHemodynamicsSelfPacedRecord } from '../engine/selfPacedProgress'
import styles from './hemodynamics-hub.module.css'
import { useHemodynamicsSelfPacedRecord } from './useHemodynamicsSelfPacedRecord'

/**
 * One map of the pathway, shared by the Overview and the Learn landing.
 *
 * The stages as native `<details>`, one per contiguous run of the canonical order; only the group
 * holding the suggested section opens on load. Every count in a summary is derived from the
 * registry. Section chips say in words whether the learner opened a section or marked it reviewed —
 * nothing about answers — and case chips name the presentation, never the diagnosis. Flattening the
 * groups reproduces the canonical order, and the "Up next" chip is the same section the call to
 * action resolves to. Every chip links out whatever the record says.
 */
export function HemodynamicsPathwayAccordion({
  record,
  id,
}: {
  readonly record: IcuHemodynamicsSelfPacedRecord
  readonly id?: string
}) {
  const groups = hemodynamicsPathwayGroups()
  const reviewed = reviewedHemodynamicsSectionIds(record)
  const next = suggestedHemodynamicsSection(record)
  const nextId = next?.section.id ?? null
  const openIndex = Math.max(
    0,
    groups.findIndex((group) => group.sections.some((section) => section.id === nextId)),
  )

  return (
    <ol className={styles.groupList} id={id} data-pathway-accordion>
      {groups.map((group, index) => (
        <li key={`${group.stage}-${index}`}>
          <details
            className={styles.groupCard}
            open={index === openIndex}
            data-stage={group.stage}
            data-group-index={index}
          >
            <summary className={styles.groupSummary}>
              <span aria-hidden="true">{index + 1}</span>
              <span className={styles.groupSummaryText}>
                <strong>{group.title}</strong>
                <small>{summaryLine(group)}</small>
              </span>
            </summary>
            <p className={styles.groupBody}>{group.description}</p>
            <div className={styles.chipRow}>
              {group.sections.map((section) => {
                const isReviewed = reviewed.has(section.id)
                const visited = isSectionVisited(record, section.id)
                const isNext = section.id === nextId
                return (
                  <Link
                    key={section.id}
                    className={styles.chip}
                    data-kind="section"
                    data-reviewed={isReviewed}
                    data-visited={visited}
                    data-recommended={isNext}
                    href={hemodynamicsSectionLinkTarget(section.id)}
                  >
                    <GraduationCap aria-hidden="true" />
                    {section.title}
                    {isReviewed ? ' ✓ reviewed' : visited ? ' · opened' : ''}
                    {isNext ? <em>Up next</em> : null}
                  </Link>
                )
              })}
              {dedupeCases(group.cases).map((entry) => (
                <Link
                  key={entry.caseId}
                  className={styles.chip}
                  data-kind="case"
                  href={{
                    pathname: `${icuHemodynamicsNavBase}/practice`,
                    query: { case: entry.caseId },
                  }}
                >
                  <BookOpenCheck aria-hidden="true" />
                  Case · {entry.title}
                </Link>
              ))}
            </div>
          </details>
        </li>
      ))}
    </ol>
  )
}

function dedupeCases(cases: HemodynamicsPathwayGroup['cases']): HemodynamicsPathwayGroup['cases'] {
  const seen = new Set<string>()
  return cases.filter((entry) => {
    if (seen.has(entry.caseId)) return false
    seen.add(entry.caseId)
    return true
  })
}

/** "Sections 3–5 · 3 sections · 2 cases · 35 min", every number counted from the registry. */
export function summaryLine(group: HemodynamicsPathwayGroup): string {
  const positions = group.sections.map(
    (section) => hemodynamicsPathwaySections.findIndex((s) => s.id === section.id) + 1,
  )
  const minutes = group.sections.reduce((total, section) => total + section.minutes, 0)
  const first = Math.min(...positions)
  const last = Math.max(...positions)
  const span = first === last ? `Section ${first}` : `Sections ${first}–${last}`
  const sectionCount = `${group.sections.length} section${group.sections.length === 1 ? '' : 's'}`
  const caseIds = new Set(group.cases.map((entry) => entry.caseId))
  const caseCount = caseIds.size > 0 ? `${caseIds.size} case${caseIds.size === 1 ? '' : 's'}` : null
  return [span, sectionCount, caseCount, `${minutes} min`].filter(Boolean).join(' · ')
}

/** The accordion over the stored record, for surfaces that hold none of their own. */
export function HemodynamicsStoredPathwayAccordion({ id }: { readonly id?: string }) {
  const { record } = useHemodynamicsSelfPacedRecord()
  return <HemodynamicsPathwayAccordion record={record} id={id} />
}

/**
 * The one door: the primary call to action on every entry surface.
 *
 * Resolves through `suggestedHemodynamicsSection` and nothing else. A fresh learner is sent to
 * section one; a learner who left a section they have not marked reviewed, back to it; otherwise
 * the first section not marked reviewed; a learner who has marked every section reviewed, to the
 * cases. None of it depends on an answer.
 */
export function HemodynamicsContinueCta({ className }: { readonly className?: string }) {
  const { record, hydrated } = useHemodynamicsSelfPacedRecord()
  const next = suggestedHemodynamicsSection(record)
  if (!next) {
    return (
      <Link
        href={`${icuHemodynamicsNavBase}/practice`}
        className={className ?? styles.continue}
        data-hemodynamics-continue="complete"
      >
        <span>Every section marked reviewed — open the cases</span>
        <ArrowRight aria-hidden="true" />
      </Link>
    )
  }
  const fresh = record.visitedSectionIds.length === 0 && record.reviewedSectionIds.length === 0
  const verb = fresh ? 'Start' : next.resumed ? 'Resume' : 'Continue'
  return (
    <Link
      href={hemodynamicsSectionLinkTarget(next.section.id)}
      className={className ?? styles.continue}
      data-hemodynamics-continue={hydrated ? 'resolved' : 'pending'}
      data-next-section={next.section.id}
    >
      <span>
        {verb} — {next.section.title}
        <small>
          Section {next.index + 1} of {next.total} · {next.section.minutes} min
        </small>
      </span>
      <ArrowRight aria-hidden="true" />
    </Link>
  )
}
