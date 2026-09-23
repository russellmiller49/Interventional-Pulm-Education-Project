'use client'

import { useId } from 'react'

import {
  describeCrrtCalculatedPressure,
  formatCrrtMmHg,
  type CrrtCalculatedPressureId,
  type CrrtRawCircuitPressures,
} from '../pressureArithmetic'
import styles from './crrt-pressure-arithmetic.module.css'

/**
 * The current TMP or filter-drop arithmetic, laid out beside its reading (F-14).
 *
 * Monitored readings, the operation, the correction term and the result each have their own
 * line, with the correction always a separately labelled, bracketed term. The result is the
 * calculation adapter's own number. The validity statement from CRRT-FELLOW-02 is passed in and
 * shown as given — a neatly worked line does not make a no-flow reading interpretable, and it
 * does not verify either correction against a device.
 */
export function CrrtPressureArithmetic({
  signal,
  raw,
  validityNote,
  displayedMmHg,
  sourceNaming = 'titled',
}: {
  readonly signal: CrrtCalculatedPressureId
  readonly raw: CrrtRawCircuitPressures
  /** The existing validity qualification for this reading, when it is not interpretable. */
  readonly validityNote?: string | null
  /** The value on the tile beside this block, when there is one, to show they agree. */
  readonly displayedMmHg?: number | null
  /**
   * The live pressure profile deliberately never names the device, so that it cannot read as a
   * description of how a console behaves; there the source keeps its page locator only.
   */
  readonly sourceNaming?: 'titled' | 'pages-only'
}) {
  const headingId = useId()
  const arithmetic = describeCrrtCalculatedPressure(signal, raw)
  const held = arithmetic.correction.status === 'placement-held-for-device-review'
  return (
    <section
      className={styles.arithmetic}
      aria-labelledby={headingId}
      data-crrt-pressure-arithmetic={signal}
      data-correction-status={arithmetic.correction.status}
      // Inside the live pressure panel the reading itself is announced; the worked line is not
      // re-read on every clock step.
      aria-live="off"
    >
      <h4 id={headingId}>How this {arithmetic.noun} is calculated now</h4>
      <p className={styles.expression}>
        <span className={styles.expressionLabel}>{arithmetic.label} =</span> {arithmetic.expression}
      </p>
      <dl className={styles.terms}>
        {arithmetic.terms.map((term) => (
          <div key={term.label} data-role={term.role}>
            <dt>
              {term.label}
              {term.role === 'monitored-site'
                ? ' · monitored site'
                : term.role === 'correction'
                  ? held
                    ? ' · placement held for device review'
                    : ' · printed in the manual'
                  : ''}
            </dt>
            <dd>{formatCrrtMmHg(term.valueMmHg)} mmHg</dd>
          </div>
        ))}
      </dl>
      <p className={styles.worked} data-crrt-arithmetic-worked>
        {arithmetic.worked}
      </p>
      {!arithmetic.roundedTermsReproduceResult ? (
        <p className={styles.note}>
          Each term is shown rounded to the nearest whole mmHg; the result is calculated from the
          unrounded readings.
        </p>
      ) : null}
      {displayedMmHg !== undefined && displayedMmHg !== null ? (
        <p className={styles.note}>
          The {arithmetic.noun} reading shows {formatCrrtMmHg(displayedMmHg)} mmHg — the same
          calculation.
        </p>
      ) : null}
      {validityNote ? (
        <p className={styles.validity} role="note" data-crrt-arithmetic-validity>
          {validityNote}
        </p>
      ) : null}
      <p className={styles.correction} data-held={held || undefined}>
        {arithmetic.correction.note}
      </p>
      <p className={styles.source}>
        Source: {sourceNaming === 'titled' ? arithmetic.sourceLabel : arithmetic.sourcePages}. Shown
        as this simulation calculates it; clinical and device review of this arithmetic is pending.
      </p>
    </section>
  )
}
