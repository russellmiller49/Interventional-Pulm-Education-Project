'use client'

import { useThoracoscopyProgress } from '../useThoracoscopyProgress'
import styles from './medical-thoracoscopy-hub.module.css'

/**
 * An honest note when this browser is not saving the learner's place. Nothing until the stored
 * progress is known, and nothing when the place is being saved.
 */
export function ProgressNotes() {
  const { status, hydrated } = useThoracoscopyProgress()
  if (!hydrated) return null
  if (status !== 'unavailable' && status !== 'unreadable') return null
  return (
    <div data-progress-notes>
      <p className={styles.note} role="note" data-progress-status={status}>
        {status === 'unavailable'
          ? 'This browser is not saving your place in the course. Everything that is open stays open.'
          : 'A saved place on this device could not be read. It is left as it is, and this visit is not being saved. Everything that is open stays open.'}
      </p>
    </div>
  )
}
