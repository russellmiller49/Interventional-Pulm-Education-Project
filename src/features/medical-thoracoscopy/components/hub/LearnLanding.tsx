import { Link } from '@/i18n/navigation'

import {
  compositionLine,
  curriculumChapter,
  curriculumSection,
  curriculumSections,
} from '../../content/curriculum'
import { MEDICAL_THORACOSCOPY_LEARN_HREF } from '../../content/routes'
import { isThoracoscopySectionId } from '../../content/sectionIds'
import { ContinueCta } from './ContinueCta'
import { StoredCourseOutline } from './CourseOutline'
import { ProgressNotes } from './ProgressNotes'
import styles from './medical-thoracoscopy-hub.module.css'

/**
 * The Learn landing: the one door and the outline. Asked for a section that is still in
 * preparation, it says so first, offers no mark of any kind, and records nothing. Asked for a
 * section that does not exist, it says that.
 */
export function LearnLanding({ requestedSection }: { readonly requestedSection?: string }) {
  const known = isThoracoscopySectionId(requestedSection)
    ? curriculumSection(requestedSection)
    : null
  return (
    <div className={styles.hub}>
      {known ? (
        <section
          className={styles.hero}
          aria-labelledby="section-heading"
          data-section-in-preparation={known.id}
        >
          <p className={styles.composition}>
            Section {known.number} of {curriculumSections.length} ·{' '}
            {curriculumChapter(known.chapter).title} · about {known.minutes} min
          </p>
          <h1 id="section-heading">{known.title}</h1>
          <p>This section is being written. It is not open yet, and nothing is recorded for it.</p>
          <p>
            <Link className={styles.backLink} href={MEDICAL_THORACOSCOPY_LEARN_HREF}>
              See all the sections
            </Link>
          </p>
        </section>
      ) : (
        <section className={styles.hero} aria-labelledby="learn-heading">
          <h1 id="learn-heading">Learn</h1>
          {requestedSection ? (
            <p className={styles.note} role="note" data-unknown-section={requestedSection}>
              There is no section with that address. Here are all of them.
            </p>
          ) : null}
          <p className={styles.composition}>{compositionLine()}</p>
          <ContinueCta />
        </section>
      )}
      <ProgressNotes />
      <section aria-labelledby="outline-heading">
        <h2 id="outline-heading" className={styles.sectionHeading}>
          The sections
        </h2>
        <StoredCourseOutline id="course-outline" />
      </section>
    </div>
  )
}
