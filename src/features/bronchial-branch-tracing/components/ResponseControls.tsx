'use client'

import type { Exercise } from '../content/types'
import { childrenOf, OPENING_POSITIONS, type OpeningPosition } from '../content/phantoms'
import type { OpeningMap } from '../engine/session'
import { OpeningSketch } from './TracingViews'
import styles from './branch-tracing.module.css'

export function BranchChoice({
  exercise,
  selected,
  onChange,
}: {
  exercise: Exercise
  selected: string | null
  onChange: (id: string) => void
}) {
  return (
    <fieldset className={styles.choices}>
      <legend>Next branch</legend>
      {[
        ...childrenOf(exercise.phantom).map((b) => ({ id: b.id, label: `Branch ${b.label}` })),
        { id: 'unresolved', label: 'Continuation unresolved' },
      ].map((b) => (
        <label key={b.id}>
          <input
            type="radio"
            name={`branch-${exercise.id}`}
            value={b.id}
            checked={selected === b.id}
            onChange={() => onChange(b.id)}
          />
          {b.label}
        </label>
      ))}
    </fieldset>
  )
}
export function OpeningEditor({
  exercise,
  openings,
  onChange,
}: {
  exercise: Exercise
  openings: OpeningMap
  onChange: (id: string, position: OpeningPosition) => void
}) {
  return (
    <section className={styles.openingEditor}>
      <h3>Your opening map</h3>
      <p className={styles.small}>Use distinct positions for the visible proximal openings.</p>
      <OpeningSketch phantom={exercise.phantom} openings={openings} />
      <div className={styles.openingControls}>
        {childrenOf(exercise.phantom).map((b) => (
          <label key={b.id}>
            Opening {b.label}
            <select
              aria-label={`Opening ${b.label}`}
              value={openings[b.id] ?? ''}
              onChange={(e) => onChange(b.id, e.target.value as OpeningPosition)}
            >
              <option value="" disabled>
                Choose position
              </option>
              {OPENING_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p} o’clock
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  )
}
export function LearnerRoute({
  branchId,
  exercise,
}: {
  branchId: string | null
  exercise: Exercise
}) {
  const children = childrenOf(exercise.phantom)
  return (
    <div className={styles.route} aria-label="Your branch route">
      <span>Parent</span>
      <span aria-hidden>↓</span>
      <div>
        {children.map((b) => (
          <span
            key={b.id}
            aria-label={
              b.id === branchId
                ? `Branch ${b.label}, your selected route`
                : `Branch ${b.label}, adjacent route`
            }
            data-selected={b.id === branchId}
          >
            Branch {b.label}
            {b.id === branchId ? ' · selected' : ''}
          </span>
        ))}
      </div>
      {branchId === 'unresolved' && <p>Distal continuation unresolved</p>}
    </div>
  )
}
