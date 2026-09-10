'use client'

import { chainStop, type ChainStopId } from '../../content/imagingChain'
import { imagingControl, IMAGING_CONTROL_PANEL } from '../../content/controlPanel'
import styles from './imaging-stage.module.css'

const POSITION_WORDS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'] as const
const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five', 'six'] as const

/** Where a walk stands, in words; the only number is the one the image-formation caption prints. */
export function walkPositionWords(index: number, total: number): string {
  if (total <= 1) return 'The only component in this walk.'
  const position = index >= total - 1 ? 'Last' : (POSITION_WORDS[index] ?? 'Next')
  const count = COUNT_WORDS[total - 1] ?? String(total)
  return `${position} of ${count} components of image formation.`
}

/** The fluoroscopy control that acts at a component, if one of the five does. */
function controlAt(stopId: ChainStopId): string | null {
  switch (stopId) {
    case 'beam':
      return `${imagingControl('angle').plainName}, and ${imagingControl('field').plainName}`
    case 'detector':
      return imagingControl('time').plainName
    case 'reconstruction':
      return imagingControl('acquisition').plainName
    case 'display':
      return imagingControl('display').plainName
    case 'source':
      return `nothing you adjust directly — ${IMAGING_CONTROL_PANEL.monitoring[0].plainName} are set by automatic exposure regulation`
    default:
      return null
  }
}

/**
 * One component of image formation: the precise statement first, the clinical name, the control
 * that acts there, its short list, and the analogy last as a secondary aid.
 */
export function ChainWalkCard({
  stopId,
  stepId,
}: {
  readonly stopId: ChainStopId
  readonly stepId: string
}) {
  const stop = chainStop(stopId)
  const control = controlAt(stopId)
  return (
    <section className={styles.walk} data-walk-stop={stop.id} aria-label={stop.title}>
      <p className={styles.kicker}>{stop.title}</p>
      <p>{stop.precise}</p>
      <dl className={styles.stopFacts}>
        <div>
          <dt>In the suite</dt>
          <dd>{stop.plainName}.</dd>
        </div>
        {control ? (
          <div>
            <dt>What you control here</dt>
            <dd>{control}.</dd>
          </div>
        ) : null}
      </dl>
      <p className={styles.kicker} id={`${stepId}-walk-checklist`} data-walk-checklist-label>
        {stop.checklistLabel}
      </p>
      <ul
        className={styles.checklist}
        aria-labelledby={`${stepId}-walk-checklist`}
        data-walk-checklist
      >
        {stop.checklist.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className={styles.analogy}>{stop.analogy}</p>
    </section>
  )
}
