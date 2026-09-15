'use client'

import { ArrowRight, GraduationCap } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { bronchPathwaySections } from '../../content/pathway'
import {
  bronchPathwayGroups,
  bronchSectionLinkTarget,
  nextBronchSection,
  reviewedBronchSectionIds,
  type BronchPathwayGroup,
} from '../../content/pathwayResolver'
import { BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF } from '../../content/routes'
import type { BronchSelfPacedRecord } from '../../engine/selfPacedProgress'
import styles from '../bronchoscopy-foundations-hub.module.css'
import { useBronchoscopyFoundationsRecord } from '../useBronchoscopyFoundationsRecord'

/**
 * One map of the pathway, shared by the hub and the Learn landing.
 *
 * The procedure phases as native `<details>`, one per contiguous run of the canonical order; only
 * the group holding the learner's next section opens on load. Every count in a summary is derived
 * from the registry. Section chips carry the learner's own marks in words as well as in state —
 * reviewed, opened, review later — and never an answer or a completion. Flattening the groups
 * reproduces the canonical order, and the "Up next" chip is the section the Continue call to action
 * resolves to.
 */
export function BronchPathwayAccordion({
  record,
  id,
}: {
  readonly record: BronchSelfPacedRecord
  readonly id?: string
}) {
  const groups = bronchPathwayGroups()
  const reviewed = reviewedBronchSectionIds(record)
  const next = nextBronchSection(record)
  const nextId = next?.section.id ?? null
  const openIndex = Math.max(
    0,
    groups.findIndex((group) => group.sections.some((section) => section.id === nextId)),
  )

  return (
    <ol className={styles.groupList} id={id} data-pathway-accordion>
      {groups.map((group, index) => (
        <li key={group.phase}>
          <details
            className={styles.groupCard}
            open={index === openIndex}
            data-pathway-phase={group.phase}
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
                const visited = record.visitedSectionIds.includes(section.id)
                const later = record.reviewLaterSectionIds.includes(section.id)
                const isNext = section.id === nextId
                return (
                  <Link
                    key={section.id}
                    className={styles.chip}
                    data-kind="section"
                    data-reviewed={isReviewed}
                    data-visited={visited}
                    data-review-later={later || undefined}
                    data-recommended={isNext}
                    href={bronchSectionLinkTarget(section.id)}
                  >
                    <GraduationCap aria-hidden="true" />
                    {section.title}
                    {isReviewed ? ' ✓ reviewed' : visited ? ' · opened' : ''}
                    {later ? <em>Review later</em> : null}
                    {isNext ? <em>Up next</em> : null}
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

/** "Sections 3–5 · 3 sections · 17 min", every number counted from the registry. */
export function summaryLine(group: BronchPathwayGroup): string {
  const positions = group.sections.map(
    (section) => bronchPathwaySections.findIndex((s) => s.id === section.id) + 1,
  )
  const minutes = group.sections.reduce((total, section) => total + section.minutes, 0)
  const first = Math.min(...positions)
  const last = Math.max(...positions)
  const span = first === last ? `Section ${first}` : `Sections ${first}–${last}`
  const sectionCount = `${group.sections.length} section${group.sections.length === 1 ? '' : 's'}`
  return [span, sectionCount, `${minutes} min`].join(' · ')
}

/** The accordion over the stored record, for surfaces that hold none of their own. */
export function BronchStoredPathwayAccordion({ id }: { readonly id?: string }) {
  const { record } = useBronchoscopyFoundationsRecord()
  return <BronchPathwayAccordion record={record} id={id} />
}

/**
 * The one door: the primary call to action on every entry surface.
 *
 * Resolves through `nextBronchSection` and nothing else. A fresh learner is sent to section one; a
 * returning learner back to the section they were in unless they marked it reviewed, otherwise to
 * the first section not marked reviewed; a learner who has marked every section, to the
 * integrated cases.
 */
export function BronchContinueCta({ className }: { readonly className?: string }) {
  const { record, hydrated } = useBronchoscopyFoundationsRecord()
  const next = nextBronchSection(record)
  if (!next) {
    return (
      <Link
        href={BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF}
        className={className ?? styles.continue}
        data-bronch-continue="complete"
      >
        <span>Every section marked reviewed — try the integrated cases</span>
        <ArrowRight aria-hidden="true" />
      </Link>
    )
  }
  const fresh = record.visitedSectionIds.length === 0 && !next.resumed
  const verb = next.resumed ? 'Resume' : fresh ? 'Start' : 'Continue'
  return (
    <Link
      href={bronchSectionLinkTarget(next.section.id)}
      className={className ?? styles.continue}
      data-bronch-continue={hydrated ? 'resolved' : 'pending'}
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
