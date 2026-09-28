import { curriculumSection, practiceScenarios } from '../../content/curriculum'
import styles from './medical-thoracoscopy-hub.module.css'

/** Practice: the scenarios, each with the sections it rehearses. None is written yet. */
export function PracticeLanding() {
  return (
    <div className={styles.hub}>
      <section className={styles.hero} aria-labelledby="practice-heading">
        <h1 id="practice-heading">Practice</h1>
        <p>
          Short scenarios, each rehearsing a decision from the Learn sections it is paired with.
        </p>
      </section>
      <ul className={styles.plainList}>
        {practiceScenarios.map((scenario) => (
          <li
            key={scenario.id}
            className={styles.sectionItem}
            data-item={scenario.id}
            data-state={scenario.state}
          >
            <span>{scenario.title}</span>
            <span className={styles.sectionMeta}>
              With {scenario.pairsWith.map((id) => curriculumSection(id).title).join(' and ')} ·{' '}
              <span className={styles.inPreparationTag}>In preparation</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
