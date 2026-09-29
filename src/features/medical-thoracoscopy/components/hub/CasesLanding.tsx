import { integratedCases } from '../../content/curriculum'
import { InPreparationList } from './MedicalThoracoscopyHub'
import styles from './medical-thoracoscopy-hub.module.css'

/** Cases: four patients followed across the whole procedure. None is written yet. */
export function CasesLanding() {
  return (
    <div className={styles.hub}>
      <section className={styles.hero} aria-labelledby="cases-heading">
        <h1 id="cases-heading">Cases</h1>
        <p>Four patients followed across the whole procedure, from the decision to the report.</p>
      </section>
      <InPreparationList items={integratedCases} />
    </div>
  )
}
