'use client'

import { ventilationLearningUnits } from '../content/learningCurriculum'
import { MechanicalVentilationLearningActivity } from './MechanicalVentilationLearningActivity'
import { useVentilationLabProgress } from './useVentilationLabProgress'
import styles from './ventilation-live-learning.module.css'

/** Enter the next running experiment directly. The course map lives beside the ventilator. */
export function MechanicalVentilationCourseHome({ locale = 'en' }: { readonly locale?: string }) {
  const { progress, ready } = useVentilationLabProgress()
  if (!ready)
    return (
      <div className={styles.lab}>
        <p className={styles.banner} role="status">
          Preparing your live patient…
        </p>
      </div>
    )
  const unit =
    ventilationLearningUnits.find((unit) => !progress.units[unit.id]?.completedAt) ??
    ventilationLearningUnits.at(-1)!
  return <MechanicalVentilationLearningActivity key={unit.id} unit={unit} locale={locale} />
}
