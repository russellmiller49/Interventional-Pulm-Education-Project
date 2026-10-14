'use client'

import { useId, useState } from 'react'

import { airwayDisplayName } from '../../content/airwayTree'
import {
  inspectionRecords,
  namingSubject,
  unnamedAirways,
} from '../../engine/scope/inspectionLedger'
import {
  isAirwayLabel,
  scopeControlId,
  type AirwayLabel,
  type ScopeCommand,
  type ScopeState,
  type ScopeViewSpec,
} from './types'
import styles from './name-segment.module.css'

/** "Right middle lobe, lateral": a segment's name without its number. */
export function segmentWords(label: AirwayLabel): string {
  const [first, ...rest] = airwayDisplayName(label).split(' · ')
  return rest.length > 0 ? rest.join(' · ') : first
}

/**
 * The naming record's question, among the controls (educator feedback, 2026-10-13).
 *
 * The survey used to be recorded through a menu in a table below the view, which a learner driving
 * the scope did not find. Now the question comes to the learner: once the tip is inside a segment
 * that has not been named, a list of the names still left opens here, by number or by name as the
 * learner prefers. The engine checks the answer (`reduceScope`, `name`); a right one records the
 * segment and takes it off the list, and the list is gone when every segment is named. What the
 * engine says about an answer is its message, which the pane already prints under the view.
 */
export function NameSegment({
  view,
  state,
  disabled,
  onName,
}: {
  view: ScopeViewSpec
  state: ScopeState
  disabled: boolean
  onName: (command: Extract<ScopeCommand, { type: 'name' }>) => void
}) {
  const [listBy, setListBy] = useState<'numbers' | 'names'>('numbers')
  const group = useId()
  if (!view.ledger?.naming) return null
  const asked = namingSubject(view, state) !== null
  const remaining = unnamedAirways(state.ledger)
  const total = inspectionRecords(state.ledger).length
  const selectId = scopeControlId('name-segment')
  return (
    <div
      className={styles.nameSegment}
      role="group"
      aria-label="Name the segment"
      data-name-segment={asked ? 'asked' : 'waiting'}
    >
      {asked ? (
        <label className={styles.question} htmlFor={selectId}>
          Which segment is this?
          <select
            id={selectId}
            value=""
            disabled={disabled}
            onChange={(event) => {
              const chosen = event.target.value
              if (isAirwayLabel(chosen)) onName({ type: 'name', airway: chosen })
            }}
          >
            <option value="">Choose…</option>
            {remaining.map((label) => (
              <option key={label} value={label}>
                {listBy === 'numbers' ? label : segmentWords(label)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className={styles.note} data-name-segment-note>
          {remaining.length === 0
            ? 'Every segment is named.'
            : 'Drive into a segment. Its list of names opens here.'}
        </span>
      )}
      <span className={styles.listBy} role="radiogroup" aria-label="List the segments by">
        {(['numbers', 'names'] as const).map((choice) => (
          <label key={choice}>
            <input
              type="radio"
              name={group}
              value={choice}
              checked={listBy === choice}
              disabled={disabled}
              onChange={() => setListBy(choice)}
            />{' '}
            {choice === 'numbers' ? 'Numbers' : 'Names'}
          </label>
        ))}
      </span>
      <span className={styles.count} data-name-segment-count>
        {total - remaining.length} of {total} named
      </span>
    </div>
  )
}
