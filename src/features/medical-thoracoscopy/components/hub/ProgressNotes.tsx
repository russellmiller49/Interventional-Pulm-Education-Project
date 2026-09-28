'use client'

import { Link } from '@/i18n/navigation'

import { reviewLaterSections, sectionLinkTarget } from '../../content/pathwayResolver'
import { useThoracoscopyProgress } from '../useThoracoscopyProgress'
import styles from './medical-thoracoscopy-hub.module.css'

/**
 * An honest note when this browser is not saving the learner's place, and the sections saved to
 * review later. Nothing until the stored progress is known, and nothing when there is nothing to say.
 */
export function ProgressNotes() {
  const { progress, status, hydrated } = useThoracoscopyProgress()
  if (!hydrated) return null
  const saved = reviewLaterSections(progress)
  const notSaving = status === 'unavailable' || status === 'unreadable'
  if (!notSaving && saved.length === 0) return null
  return (
    <div data-progress-notes>
      {notSaving ? (
        <p className={styles.note} role="note" data-progress-status={status}>
          {status === 'unavailable'
            ? 'This browser is not saving your place in the course. Everything that is open stays open.'
            : 'A saved place on this device could not be read. It is left as it is, and this visit is not being saved. Everything that is open stays open.'}
        </p>
      ) : null}
      {saved.length > 0 ? (
        <nav aria-label="Saved for review">
          <p>Saved for review</p>
          <ul className={styles.plainList}>
            {saved.map((section) => (
              <li key={section.id}>
                <Link href={sectionLinkTarget(section.id)}>{section.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
