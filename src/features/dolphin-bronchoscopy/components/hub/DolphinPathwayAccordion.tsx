'use client'

import { ArrowRight, GraduationCap } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { dolphinPathwaySections } from '../../content/pathway'
import {
  dolphinPathwayGroups,
  recommendedDolphinSection,
  reviewedDolphinSectionIds,
  reviewLaterDolphinSections,
  visitedDolphinSectionIds,
  type DolphinPathwayGroup,
} from '../../content/pathwayResolver'
import { DOLPHIN_ASSESS_HREF, dolphinSectionLinkTarget } from '../../content/routes'
import type { DolphinProgress } from '../../engine/selfPacedProgress'
import styles from '../dolphin-hub.module.css'
import { useDolphinProgress } from '../useDolphinProgress'

/**
 * One map of the pathway, shared by the hub and the Learn landing.
 *
 * The clinical phases as native `<details>`, one per contiguous run of the canonical order; only the
 * group holding the recommended section opens on load. Every section is always a link. Chips say in
 * words what this device knows — opened, reviewed, saved for review — and never anything about
 * answers (self-paced rules). Flattening the groups reproduces the canonical order, and the "Up next" chip is
 * the section the Start, Resume or Continue call to action resolves to.
 */
export function DolphinPathwayAccordion({
  progress,
  id,
}: {
  readonly progress: DolphinProgress
  readonly id?: string
}) {
  const groups = dolphinPathwayGroups()
  const visited = visitedDolphinSectionIds(progress)
  const reviewed = reviewedDolphinSectionIds(progress)
  const saved = new Set(progress.reviewLaterSectionIds)
  const next = recommendedDolphinSection(progress)
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
                const isVisited = visited.has(section.id)
                const isSaved = saved.has(section.id)
                const isNext = section.id === nextId
                return (
                  <Link
                    key={section.id}
                    className={styles.chip}
                    data-kind="section"
                    data-visited={isVisited}
                    data-reviewed={isReviewed}
                    data-review-later={isSaved}
                    data-recommended={isNext}
                    href={dolphinSectionLinkTarget(section.id)}
                  >
                    <GraduationCap aria-hidden="true" />
                    {section.title}
                    {isReviewed ? ' · reviewed' : isVisited ? ' · opened' : ''}
                    {isSaved ? ' · saved for review' : ''}
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
export function summaryLine(group: DolphinPathwayGroup): string {
  const positions = group.sections.map(
    (section) => dolphinPathwaySections.findIndex((s) => s.id === section.id) + 1,
  )
  const minutes = group.sections.reduce((total, section) => total + section.minutes, 0)
  const first = Math.min(...positions)
  const last = Math.max(...positions)
  const span = first === last ? `Section ${first}` : `Sections ${first}–${last}`
  const sectionCount = `${group.sections.length} section${group.sections.length === 1 ? '' : 's'}`
  return [span, sectionCount, `${minutes} min`].join(' · ')
}

/** The accordion over the stored progress, for surfaces that hold none of their own. */
export function DolphinStoredPathwayAccordion({ id }: { readonly id?: string }) {
  const { progress } = useDolphinProgress()
  return <DolphinPathwayAccordion progress={progress} id={id} />
}

/**
 * The one door: the primary call to action on every entry surface.
 *
 * Resolves through `recommendedDolphinSection` and nothing else. A fresh learner is sent to section
 * one; a learner who left a section unfinished, back to it; otherwise the first section not yet
 * marked reviewed; a learner who has marked every section reviewed, to the integrated cases. It
 * recommends; it never locks anything.
 */
export function DolphinContinueCta({ className }: { readonly className?: string }) {
  const { progress, hydrated } = useDolphinProgress()
  const next = recommendedDolphinSection(progress)
  if (!next) {
    return (
      <Link
        href={DOLPHIN_ASSESS_HREF}
        className={className ?? styles.continue}
        data-dolphin-continue="complete"
      >
        <span>Every section marked reviewed — open the integrated cases</span>
        <ArrowRight aria-hidden="true" />
      </Link>
    )
  }
  const fresh = progress.visitedSectionIds.length === 0 && progress.reviewedSectionIds.length === 0
  const verb = next.resumed ? 'Resume' : fresh ? 'Start' : 'Continue'
  return (
    <Link
      href={dolphinSectionLinkTarget(next.section.id)}
      className={className ?? styles.continue}
      data-dolphin-continue={hydrated ? 'resolved' : 'pending'}
      data-next-section={next.section.id}
      data-resumed={next.resumed}
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

/**
 * A second door to the first section, beside the one the recommendation resolves to.
 *
 * Navigation and nothing else: it deletes no progress, marks nothing reviewed, and leaves the
 * recommendation exactly as it was. It renders only once the stored progress is known, and only when the
 * recommendation is not already the first section.
 */
export function DolphinStartAtFirstSectionLink({ className }: { readonly className?: string }) {
  const { progress, hydrated } = useDolphinProgress()
  const first = dolphinPathwaySections[0]
  const next = recommendedDolphinSection(progress)
  if (!hydrated || !first || next?.section.id === first.id) return null
  return (
    <Link
      href={dolphinSectionLinkTarget(first.id)}
      className={className ?? styles.startFirst}
      data-dolphin-start-first={first.id}
    >
      <span>
        Start at Section 1 — {first.title}
        <small> Your saved place is kept.</small>
      </span>
    </Link>
  )
}

/**
 * Sections saved to review later, and an honest note when this browser is not saving the learner's
 * place. Renders nothing until hydrated, and nothing when there is nothing to say.
 */
export function DolphinProgressNotes({ className }: { readonly className?: string }) {
  const { progress, status, hydrated } = useDolphinProgress()
  if (!hydrated) return null
  const saved = reviewLaterDolphinSections(progress)
  const notSaving = status === 'unavailable' || status === 'unreadable'
  if (!notSaving && saved.length === 0) return null
  return (
    <div className={className} data-progress-notes>
      {notSaving ? (
        <p className="rounded-2xl border p-4 text-sm" role="note" data-progress-status={status}>
          {status === 'unavailable'
            ? 'This browser is not saving your place in the module. Every section and case stays open.'
            : 'Saved places on this device could not be read. They are left as they are, and this visit is not being saved. Every section and case stays open.'}
        </p>
      ) : null}
      {saved.length > 0 ? (
        <nav aria-label="Saved for review" data-review-later-list>
          <p className="text-sm font-semibold">Saved for review</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {saved.map((section) => (
              <li key={section.id}>
                <Link
                  className={styles.chip}
                  data-kind="saved-section"
                  href={dolphinSectionLinkTarget(section.id)}
                >
                  {section.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
