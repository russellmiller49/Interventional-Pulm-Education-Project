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
              aria-label={`Mark ${i + 1}: ${point.airway.name}${point.landmark ? `, ${point.landmark.toLowerCase()}` : ''}`}
            >
              <span aria-hidden="true">{marks[i] ? '✓' : '○'}</span>
              <div>
                <strong>
                  {point.airway.code}
                  {point.landmark && ` · ${point.landmark}`}
                </strong>
                <span>{point.airway.name}</span>
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
        Follow these named bronchi in order. Proximal and distal distinguish positions within the
        same bronchus along this trace.
      </p>
    </div>
  )
}
export function CtAirwayGuide({ trace }: { trace: CtTrace }) {
  return (
    <div className={styles.airwayGuide}>
      <h3>Airway names</h3>
      <p aria-label="Named airway route">
        {trace.airwayPath.map((airway, i) => (
          <span key={`${i}-${airway.code}`}>
            {i > 0 && <span aria-hidden="true"> → </span>}
            <abbr title={airway.name}>{airway.code}</abbr>
          </span>
        ))}
      </p>
      <p>
        R/L identifies the side; B denotes a bronchus and S its pulmonary segment. Numbers identify
        segmental bronchi; a, b and c identify subsegments. LB1+2 is the left apicoposterior
        bronchus.
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
