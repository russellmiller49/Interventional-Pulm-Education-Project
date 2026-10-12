import type { ReactNode } from 'react'

import { PI_NUMBERS, piNumberCitation, type PiNumberId } from '../../content/teachingNumbers'
import styles from './imaging-stage.module.css'

/**
 * Sourced numbers beside the teaching they belong to: dose action levels, occupational limits,
 * published dose–area products and the VESPA result. Every figure comes from the numbers register,
 * and each row prints its source.
 */
export function ImagingReferenceValues({
  title,
  ids,
  children,
}: {
  readonly title: string
  readonly ids: readonly PiNumberId[]
  readonly children?: ReactNode
}) {
  return (
    <section className={styles.teachingCard} data-reference-values>
      <p className={styles.kicker}>{title}</p>
      <dl className={styles.referenceValues}>
        {ids.map((id) => {
          const row = PI_NUMBERS.get(id)
          return (
            <div key={id} data-teaching-number={id}>
              <dt>{row.label}</dt>
              <dd>
                <strong>{row.value}</strong>
                {row.appliesTo ? ` · ${row.appliesTo}.` : ''}
                {row.note ? ` ${row.note}` : ''} <small>({piNumberCitation(id)})</small>
              </dd>
            </div>
          )
        })}
      </dl>
      {children}
    </section>
  )
}
