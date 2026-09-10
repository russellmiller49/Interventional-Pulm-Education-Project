'use client'

import { ArrowRight, GraduationCap } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { peripheralImagingPathwaySections } from '../../content/pathway'
import {
  imagingPathwayGroups,
  imagingSectionLinkTarget,
  nextIncompleteImagingSection,
  workedImagingSectionIds,
  type ImagingPathwayGroup,
} from '../../content/pathwayResolver'
import { PERIPHERAL_IMAGING_ASSESS_HREF } from '../../content/routes'
import type { ImagingRecord } from '../../engine/learnProgress'
import styles from '../peripheral-imaging-hub.module.css'
import { usePeripheralImagingRecord } from '../usePeripheralImagingRecord'

/**
 * One map of the pathway, shared by the hub and the Learn landing.
 *
 * The clinical phases as native `<details>`, one per contiguous run of the canonical order; only the group
 * holding the learner's next section opens on load. Every count in a summary is derived from the
 * registry. Section chips carry the worked state in words as well as in state. Flattening the
 * groups reproduces the canonical order, and the "Up next" chip is the same section the Continue
 * call to action resolves to.
 */
export function ImagingPathwayAccordion({
  record,
  id,
}: {
  readonly record: ImagingRecord
  readonly id?: string
}) {
  const groups = imagingPathwayGroups()
  const worked = workedImagingSectionIds(record)
  const next = nextIncompleteImagingSection(record)
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
                const done = worked.has(section.id)
                const isNext = section.id === nextId
                return (
                  <Link
                    key={section.id}
                    className={styles.chip}
                    data-kind="section"
                    data-complete={done}
                    data-recommended={isNext}
                    href={imagingSectionLinkTarget(section.id)}
                  >
                    <GraduationCap aria-hidden="true" />
                    {section.title}
                    {done ? ' ✓ worked through' : ''}
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
export function summaryLine(group: ImagingPathwayGroup): string {
  const positions = group.sections.map(
    (section) => peripheralImagingPathwaySections.findIndex((s) => s.id === section.id) + 1,
  )
  const minutes = group.sections.reduce((total, section) => total + section.minutes, 0)
  const first = Math.min(...positions)
  const last = Math.max(...positions)
  const span = first === last ? `Section ${first}` : `Sections ${first}–${last}`
  const sectionCount = `${group.sections.length} section${group.sections.length === 1 ? '' : 's'}`
  return [span, sectionCount, `${minutes} min`].join(' · ')
}

/** The accordion over the stored record, for surfaces that hold none of their own. */
export function ImagingStoredPathwayAccordion({ id }: { readonly id?: string }) {
  const { record } = usePeripheralImagingRecord()
  return <ImagingPathwayAccordion record={record} id={id} />
}

/**
 * The one door: the primary call to action on every entry surface.
 *
 * Resolves through `nextIncompleteImagingSection` and nothing else. A fresh learner is sent to
 * section one; a learner part-way through, to the first section they have not worked through,
 * whether or not it is the one they opened last; a learner who has finished, to the capstone.
 */
export function ImagingContinueCta({ className }: { readonly className?: string }) {
  const { record, hydrated } = usePeripheralImagingRecord()
  const next = nextIncompleteImagingSection(record)
  if (!next) {
    return (
      <Link
        href={PERIPHERAL_IMAGING_ASSESS_HREF}
        className={className ?? styles.continue}
        data-imaging-continue="complete"
      >
        <span>Every section worked through — open the capstone</span>
        <ArrowRight aria-hidden="true" />
      </Link>
    )
  }
  const fresh = record.completedSectionIds.length === 0 && !next.resumed
  const verb = fresh ? 'Start' : next.resumed ? 'Resume' : 'Continue'
  return (
    <Link
      href={imagingSectionLinkTarget(next.section.id)}
      className={className ?? styles.continue}
      data-imaging-continue={hydrated ? 'resolved' : 'pending'}
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
