import {
  compositionLine,
  COURSE_AUDIENCE,
  integratedCases,
  MODEL_BOUNDARIES,
  practiceScenarios,
} from '../../content/curriculum'
import { spineSentence } from '../../content/spine'
import { ContinueCta } from './ContinueCta'
import { StoredCourseOutline } from './CourseOutline'
import { ProgressNotes } from './ProgressNotes'
import styles from './medical-thoracoscopy-hub.module.css'

/**
 * The course's front page: what it covers and for whom, the one door, the outline, what practice
 * and cases there will be, and what the simulation does not show.
 */
export function MedicalThoracoscopyHub() {
  return (
    <div className={styles.hub}>
      <section className={styles.hero} aria-labelledby="hub-heading">
        <h1 id="hub-heading">{spineSentence()}</h1>
        <p>
          {COURSE_AUDIENCE.primary} {COURSE_AUDIENCE.prerequisites}
        </p>
        <p className={styles.composition}>{compositionLine()}</p>
        <ContinueCta />
      </section>
      <ProgressNotes />
      <section aria-labelledby="outline-heading">
        <h2 id="outline-heading" className={styles.sectionHeading}>
          The sections
        </h2>
        <StoredCourseOutline id="course-outline" />
      </section>
      <section aria-labelledby="practice-heading">
        <h2 id="practice-heading" className={styles.sectionHeading}>
          Practice
        </h2>
        <InPreparationList items={practiceScenarios} />
      </section>
      <section aria-labelledby="cases-heading">
        <h2 id="cases-heading" className={styles.sectionHeading}>
          Cases
        </h2>
        <InPreparationList items={integratedCases} />
      </section>
      <section aria-labelledby="boundaries-heading">
        <h2 id="boundaries-heading" className={styles.sectionHeading}>
          What the simulation does not show
        </h2>
        <ul className={styles.boundaries}>
          {MODEL_BOUNDARIES.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function InPreparationList({
  items,
}: {
  readonly items: readonly { readonly id: string; readonly title: string; readonly state: string }[]
}) {
  return (
    <ul className={styles.plainList}>
      {items.map((item) => (
        <li
          key={item.id}
          className={styles.sectionItem}
          data-item={item.id}
          data-state={item.state}
        >
          <span>{item.title}</span>
          <span className={styles.inPreparationTag}>In preparation</span>
        </li>
      ))}
    </ul>
  )
}
