import type { BronchLearnUnit } from '../../content/learnUnit'
import type { BronchSectionDefinition } from '../../content/types'
import { formatSourceRef } from '../../data/sources'
import styles from './bronch-stage.module.css'

export function BronchPilotTeaching({
  unit,
  section,
  hintShown,
}: {
  readonly unit: BronchLearnUnit
  readonly section: BronchSectionDefinition
  readonly hintShown: boolean
}) {
  const deciding = unit.support === 'check' || unit.support === 'transfer'
  return (
    <div className={styles.teaching} data-pilot-teaching={unit.id}>
      <section className={styles.teachingCard}>
        <p className={styles.kicker}>
          {unit.support === 'guided'
            ? 'Learn, watch, then try'
            : unit.support === 'repeat'
              ? 'Practice without the action cue'
              : 'Learn'}
        </p>
        <h2>{unit.heading}</h2>
        {unit.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {unit.notice ? <p className={styles.increment}>{unit.notice}</p> : null}
        {(unit.support === 'guided' || hintShown) && unit.cue ? (
          <p data-pilot-cue>
            <strong>Try this.</strong> {unit.cue}
          </p>
        ) : null}
        <p className={styles.figureCaption}>
          Sources: {unit.sourceRefs.map(formatSourceRef).join('; ')}. Teaching adaptation; review
          pending.
        </p>
      </section>
      {unit.orientation ? (
        <p className={styles.boundaryLine}>
          Reloading starts an incomplete lesson at the beginning. First answers and completed lesson
          records remain on this device.
        </p>
      ) : null}
      {!deciding ? (
        <details className={styles.teachingCard}>
          <summary>More on technique and model limits</summary>
          <p>{section.modelBoundary}</p>
          <p>{section.physicalSkillNote}</p>
        </details>
      ) : null}
    </div>
  )
}
