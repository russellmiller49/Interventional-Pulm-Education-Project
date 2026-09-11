'use client'

import { useId, useState } from 'react'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { BronchLedger, Plausibility } from '../../content/types'
import type { LedgerCommitment } from '../../engine/stageSession'
import styles from './bronch-stage.module.css'

/** Milligrams from a concentration in mg/mL and a volume in mL: arithmetic, never a dose check. */
export function ledgerRowMg(concentrationMgPerMl: number, volumeMl: number): number {
  return Math.round(concentrationMgPerMl * volumeMl * 100) / 100
}

const TOLERANCE_MG = 0.5

/**
 * The shared accounting table (drill D19): each measured line is concentration × volume, entered
 * by the learner in milligrams; an unknown line has no number and says why. The question under
 * the table is what the record allows you to state. The keyed answer completes the step; an
 * unsafe answer is refused and the table stays open; any other answer shows its reasoning and
 * the question is asked again. The first answer is the one kept (A10, A27).
 */
export function BronchLedgerControl({
  ledger,
  commitment,
  onEntry,
  onTotal,
}: {
  readonly ledger: BronchLedger
  readonly commitment: LedgerCommitment
  readonly onEntry: (rowId: string, mg: number) => void
  readonly onTotal: (choiceId: string, plausibility: Plausibility) => void
}) {
  const base = useId()
  const [selected, setSelected] = useState<string | null>(null)
  const measured = ledger.rows.filter((row) => row.kind === 'measured')
  const entered = measured.every((row) => commitment.entries[row.id] !== undefined)
  const held = commitment.heldTotalChoiceId !== null
  const last = commitment.lastTotalChoiceId
    ? ledger.totalChoices.find((choice) => choice.id === commitment.lastTotalChoiceId)
    : undefined
  const lastOutcome = !last
    ? undefined
    : last.plausibility === 'best'
      ? 'held'
      : last.plausibility === 'unsafe'
        ? 'refused'
        : 'other'
  return (
    <div className={styles.act} data-bronch-ledger={ledger.id} data-held={held}>
      <p className={styles.verdict}>{ledger.prompt}</p>
      <table className={styles.ledgerTable} aria-label="The accounting table">
        <thead>
          <tr>
            <th scope="col">Given</th>
            <th scope="col">Concentration</th>
            <th scope="col">Volume</th>
            <th scope="col">Milligrams</th>
          </tr>
        </thead>
        <tbody>
          {ledger.rows.map((row) => {
            if (row.kind === 'unknown') {
              return (
                <tr key={row.id} data-ledger-row={row.id} data-ledger-unknown>
                  <th scope="row">
                    {row.label}
                    <small className={styles.figureCaption}> {row.detail}</small>
                  </th>
                  <td colSpan={3}>Not known from the record: {row.reason}</td>
                </tr>
              )
            }
            const entry = commitment.entries[row.id]
            const expected = ledgerRowMg(row.concentrationMgPerMl, row.volumeMl)
            const check =
              entry === undefined
                ? undefined
                : Math.abs(entry - expected) <= TOLERANCE_MG
                  ? 'matches'
                  : 'recheck'
            const inputId = `${base}-${row.id}`
            return (
              <tr key={row.id} data-ledger-row={row.id} data-ledger-check={check}>
                <th scope="row">
                  <label htmlFor={inputId}>
                    {row.label}
                    <small className={styles.figureCaption}> {row.detail}</small>
                  </label>
                </th>
                <td>{row.concentrationMgPerMl} mg/mL</td>
                <td>{row.volumeMl} mL</td>
                <td>
                  <input
                    id={inputId}
                    className={styles.numberInput}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    value={entry ?? ''}
                    disabled={held}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (event.target.value !== '' && Number.isFinite(value))
                        onEntry(row.id, value)
                    }}
                  />
                  {check ? (
                    <small className={styles.figureCaption}>
                      {' '}
                      {check === 'matches'
                        ? 'Matches the arithmetic.'
                        : 'Check the arithmetic: concentration times volume.'}
                    </small>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className={styles.boundaryLine} data-ledger-boundary>
        {ledger.boundary}
      </p>
      <fieldset className={styles.choices} disabled={held || !entered} data-ledger-total>
        <legend>{ledger.totalPrompt}</legend>
        {!entered ? (
          <p className={styles.verdict} role="status">
            Enter the milligrams for every measured line first.
          </p>
        ) : null}
        {orderChoices(ledger.id, ledger.totalChoices).map((choice) => (
          <label
            key={choice.id}
            className={styles.choice}
            data-selected={(commitment.heldTotalChoiceId ?? selected) === choice.id}
          >
            <input
              type="radio"
              name={`bronch-ledger-${ledger.id}`}
              value={choice.id}
              checked={(commitment.heldTotalChoiceId ?? selected) === choice.id}
              onChange={() => setSelected(choice.id)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
        {!held ? (
          <button
            type="button"
            className={styles.orderActions}
            data-ledger-answer
            disabled={!selected || !entered}
            onClick={() => {
              const choice = ledger.totalChoices.find((candidate) => candidate.id === selected)
              if (choice) onTotal(choice.id, choice.plausibility)
            }}
          >
            Answer
          </button>
        ) : null}
      </fieldset>
      {last ? (
        <p className={styles.verdict} data-ledger-outcome={lastOutcome} data-tone={lastOutcome}>
          <strong>
            {lastOutcome === 'held'
              ? 'Held.'
              : lastOutcome === 'refused'
                ? 'Refused: that answer is unsafe.'
                : 'Not the answer the record allows.'}
          </strong>{' '}
          {last.rationale}
          {lastOutcome === 'other' ? ' Answer again.' : ''}
          {lastOutcome === 'refused' ? ' The table stays open.' : ''}
        </p>
      ) : null}
    </div>
  )
}
