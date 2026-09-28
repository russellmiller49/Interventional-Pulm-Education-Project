'use client'

import { Link } from '@/i18n/navigation'

import {
  chapterGroups,
  chapterSummaryLine,
  isOpenable,
  nextStep,
  reviewedSectionIds,
  reviewLaterSections,
  sectionLinkTarget,
  visitedSectionIds,
} from '../../content/pathwayResolver'
import type { ThoracoscopyProgress } from '../../engine/selfPacedProgress'
import { useThoracoscopyProgress } from '../useThoracoscopyProgress'
import styles from './medical-thoracoscopy-hub.module.css'

/**
 * The course outline: one native `<details>` per chapter, the chapters tiling the canonical order.
 * A section a learner can open is a link, with what this device knows about it in words; a section
 * in preparation is listed by title, is not a link, and says so. Only the chapter holding the next
 * step opens on load; with nothing open yet, the first chapter does.
 */
export function CourseOutline({
  progress,
  id,
}: {
  readonly progress: ThoracoscopyProgress
  readonly id?: string
}) {
  const groups = chapterGroups()
  const visited = visitedSectionIds(progress)
  const reviewed = reviewedSectionIds(progress)
  const saved = new Set(reviewLaterSections(progress).map((section) => section.id))
  const step = nextStep(progress)
  const nextId = step.kind === 'section' ? step.section.id : null
  const openIndex = Math.max(
    0,
    groups.findIndex((group) => group.sections.some((section) => section.id === nextId)),
  )

  return (
    <ol className={styles.groupList} id={id} data-course-outline>
      {groups.map((group) => (
        <li key={group.chapter.id}>
          <details
            className={styles.groupCard}
            open={group.index === openIndex}
            data-chapter={group.chapter.id}
          >
            <summary className={styles.groupSummary}>
              <span aria-hidden="true">{group.index + 1}</span>
              <span className={styles.groupSummaryText}>
                <strong>{group.chapter.title}</strong>
                <small>{chapterSummaryLine(group)}</small>
              </span>
            </summary>
            <p className={styles.groupBody}>{group.chapter.description}</p>
            <ol className={styles.sectionList}>
              {group.sections.map((section) => {
                const meta = `Section ${section.number} · about ${section.minutes} min`
                if (!isOpenable(section)) {
                  return (
                    <li
                      key={section.id}
                      className={styles.sectionItem}
                      data-section={section.id}
                      data-state="in-preparation"
                    >
                      <span>{section.title}</span>
                      <span className={styles.sectionMeta}>
                        {meta} · <span className={styles.inPreparationTag}>In preparation</span>
                      </span>
                    </li>
                  )
                }
                const status = reviewed.has(section.id)
                  ? ' · reviewed'
                  : visited.has(section.id)
                    ? ' · opened'
                    : ''
                return (
                  <li
                    key={section.id}
                    className={styles.sectionItem}
                    data-section={section.id}
                    data-state="available"
                  >
                    <Link href={sectionLinkTarget(section.id)}>
                      {section.title}
                      {section.id === nextId ? <em className={styles.upNext}>Up next</em> : null}
                    </Link>
                    <span className={styles.sectionMeta}>
                      {meta}
                      {status}
                      {saved.has(section.id) ? ' · saved for review' : ''}
                    </span>
                  </li>
                )
              })}
            </ol>
          </details>
        </li>
      ))}
    </ol>
  )
}

/** The outline over the stored progress. */
export function StoredCourseOutline({ id }: { readonly id?: string }) {
  const { progress } = useThoracoscopyProgress()
  return <CourseOutline progress={progress} id={id} />
}
