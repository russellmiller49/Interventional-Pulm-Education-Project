import type { CourseProgressStatus } from '../engine/selfPacedProgress'
import styles from './course.module.css'

/** An honest note when this browser is not saving the learner's place. Nothing is locked. */
export function StorageNotice({ status }: { status: CourseProgressStatus }) {
  if (status === 'unavailable')
    return (
      <p role="status" className={styles.notice}>
        This browser is not saving your place in the course. Everything stays open; your place,
        reviewed marks and saved-for-later marks will not survive a reload.
      </p>
    )
  if (status === 'unreadable')
    return (
      <p role="status" className={styles.notice}>
        A saved course record in this browser could not be read. It has been left unchanged and
        nothing new is being saved. Everything stays open.
      </p>
    )
  return null
}
