import { SCOPE_CONTROL_PANEL } from '../../content/controlPanel'
import type { BronchLearnUnit } from '../../content/learnUnit'
import { bronchSection } from '../../content/pathway'
import { ReferenceLink } from '../ReferenceLink'
import type { BronchSectionDefinition } from '../../content/types'
import { formatSourceRef } from '../../data/sources'
import styles from './bronch-stage.module.css'

/**
 * The five controls, named where the lesson about them starts (fellow walkthrough A11).
 *
 * The names and the sentence are the Reference's own (`SCOPE_CONTROL_PANEL`), so the lesson and
 * the Reference cannot list different controls. The list says which of the five this bench
 * practises and where the fifth is developed, and keeps the five controls apart from the five
 * questions of the first section. It adds no control and changes none.
 */
function FiveControlsList() {
  const accessories = bronchSection('protected-accessories').title
  const sharedAirway = bronchSection('shared-airway').title
  const instrument = bronchSection('pre-use-check').title
  return (
    <section data-five-controls-list>
      <h3 className={styles.kicker}>The five controls</h3>
      <p>{SCOPE_CONTROL_PANEL.sentence}</p>
      <ol>
        {SCOPE_CONTROL_PANEL.controls.map((control) => (
          <li key={control.id} data-five-control={control.id}>
            {control.plainName}
          </li>
        ))}
      </ol>
      <p>
        This lesson practises the first four on the bench. The fifth, the accessory state, is
        developed in “{accessories}”. These five controls are what your hands change; they are
        separate from the five questions introduced in “{sharedAirway}”.{' '}
        <ReferenceLink anchor="five-controls">The five controls in the Reference</ReferenceLink>
      </p>
      <p data-refresher-note>
        Refresher: the instrument overview on this screen is the one from “{instrument}”, repeated
        so that this lesson stands on its own.
      </p>
    </section>
  )
}

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
              ? 'Optional repeat: the same movement without the action cue'
              : 'Learn'}
        </p>
        <h2>{unit.heading}</h2>
        {unit.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {unit.orientation && section.id === 'five-controls' ? <FiveControlsList /> : null}
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
          Reloading starts this lesson again at the beginning. Answers are not saved; where you left
          off and the sections you mark stay on this device.
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
