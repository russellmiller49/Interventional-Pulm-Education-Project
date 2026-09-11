'use client'

import type { Course, CtMark, CtTrace } from '../content/ct-types'
import { COURSE_OPTIONS } from '../content/ct-types'
import styles from './branch-tracing.module.css'

export function CtTraceList({
  trace,
  marks,
  active,
  onActive,
}: {
  trace: CtTrace
  marks: (CtMark | null)[]
  active: number
  onActive?: (index: number) => void
}) {
  return (
    <div className={styles.traceList}>
      <h3>Your branch map</h3>
      <ol>
        {trace.checkpoints.map((point, i) => (
          <li key={point.id}>
            <button
              aria-current={active === i ? 'step' : undefined}
              onClick={() => onActive?.(i)}
              disabled={!onActive}
            >
              <span>{i + 1}</span>
              <div>
                <strong>CT level {point.slice}</strong>
                <small>
                  {!marks[i]
                    ? 'Awaiting your lumen mark'
                    : marks[i]?.pixel === null
                      ? 'Continuation unresolved'
                      : 'Lumen marked'}
                </small>
              </div>
            </button>
          </li>
        ))}
      </ol>
      <p className={styles.small}>
        The sequence records your proposed connection. Level numbers may rise, fall or stay the same
        along a real airway.
      </p>
    </div>
  )
}
export function CtCourseControl({
  value,
  onChange,
}: {
  value: Course | ''
  onChange: (value: Course) => void
}) {
  return (
    <label className={styles.courseChoice}>
      <strong>How does this part of the airway continue?</strong>
      <select
        aria-label="Airway course"
        value={value}
        onChange={(e) => onChange(e.target.value as Course)}
      >
        <option value="" disabled>
          Choose the course you traced
        </option>
        {Object.entries(COURSE_OPTIONS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
