'use client'

import { useState } from 'react'

import type { LidocaineLedgerSpec } from '../../../content/ledgers'
import { ledgerState, maxMg, mgOf, mlOf } from '../../../engine/lidocaineLedger'
import styles from '../dolphin-stage.module.css'

function close(entered: string, expected: number): boolean {
  const value = Number(entered.replace(',', '.'))
  return Number.isFinite(value) && Math.abs(value - expected) <= 0.1 + 1e-9
}

/**
 * The lidocaine ledger: the maximum for this animal, its volume in 1% and in 2%, the volumes
 * already planned, and what is left. The learner works each figure; the ledger then shows its own.
 * Educational arithmetic for the exercise, not a dose check.
 */
export function LedgerControl({
  ledger,
  done,
  onDone,
}: {
  readonly ledger: LidocaineLedgerSpec
  readonly done: boolean
  readonly onDone: () => void
}) {
  const [entries, setEntries] = useState({ maxMg: '', ml1: '', ml2: '', remaining: '' })
  const [checked, setChecked] = useState(done)
  const max = maxMg(ledger.weightKg, ledger.mgPerKg)
  const state = ledgerState(ledger.weightKg, ledger.mgPerKg, ledger.planned)
  const remainingMl = mlOf(state.remainingMg, ledger.remainingPercent)
  const expected = {
    maxMg: max,
    ml1: mlOf(max, 1),
    ml2: mlOf(max, 2),
    remaining: remainingMl,
  }
  const fields: readonly { key: keyof typeof entries; label: string; unit: string }[] = [
    {
      key: 'maxMg',
      label: `Maximum for ${ledger.weightKg} kg at ${ledger.mgPerKg} mg/kg`,
      unit: 'mg',
    },
    { key: 'ml1', label: 'That maximum as 1% lidocaine', unit: 'mL' },
    { key: 'ml2', label: 'That maximum as 2% lidocaine', unit: 'mL' },
    { key: 'remaining', label: `Left for ${ledger.remainingLabel.toLowerCase()}`, unit: 'mL' },
  ]
  return (
    <section
      className={styles.question}
      aria-label="Lidocaine ledger"
      data-landmark="Lidocaine ledger"
      data-ledger={ledger.id}
    >
      <p className={styles.situation}>{ledger.situation}</p>
      <p className={styles.rowFeedback}>
        One percent is 10 mg in each milliliter; two percent is 20 mg. Every way it is given counts
        against the same maximum.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">Lidocaine already planned</caption>
          <thead>
            <tr>
              <th scope="col">Planned</th>
              <th scope="col">Volume</th>
              <th scope="col">Strength</th>
              <th scope="col">Milligrams</th>
            </tr>
          </thead>
          <tbody>
            {ledger.planned.map((line) => (
              <tr key={line.id}>
                <td>{line.label}</td>
                <td>{line.volumeMl} mL</td>
                <td>{line.percent}%</td>
                <td>{mgOf(line.volumeMl, line.percent)} mg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.rows}>
        {fields.map((field) => {
          const ok = checked && close(entries[field.key], expected[field.key])
          return (
            <label
              key={field.key}
              className={styles.row}
              data-verdict={checked ? (ok ? 'holds' : 'misplaced') : undefined}
            >
              <span>{field.label}</span>
              <span className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  className="w-32 rounded-md border px-2 py-1 text-slate-950"
                  value={entries[field.key]}
                  disabled={checked}
                  onChange={(event) =>
                    setEntries((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  aria-label={`${field.label}, in ${field.unit}`}
                  data-ledger-field={field.key}
                />
                {field.unit}
              </span>
              {checked ? (
                <p className={styles.rowFeedback} data-ledger-expected={field.key}>
                  {ok ? 'Holds: ' : 'The ledger has '}
                  {expected[field.key]} {field.unit}.
                </p>
              ) : null}
            </label>
          )
        })}
      </div>
      {checked ? (
        <p className={styles.note} data-tone="done" data-ledger-summary>
          {ledger.planned.reduce((sum, line) => sum + mgOf(line.volumeMl, line.percent), 0)} mg are
          already planned, leaving {state.remainingMg} mg: {remainingMl} mL of{' '}
          {ledger.remainingPercent}% for the jelly and the bronchi together. Every further
          milliliter is written against this line.
        </p>
      ) : null}
      <div className={styles.actions}>
        {checked ? null : (
          <button
            type="button"
            className={styles.button}
            data-primary="true"
            onClick={() => {
              setChecked(true)
              onDone()
            }}
            data-check-ledger
          >
            Check the ledger
          </button>
        )}
      </div>
    </section>
  )
}
