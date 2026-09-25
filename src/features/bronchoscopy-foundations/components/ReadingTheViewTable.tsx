import type { ReactNode } from 'react'

import { grammarRowControl, type GrammarRow } from '../content/grammar'
import styles from './reading-the-view.module.css'

const COLUMNS = {
  see: 'You see',
  lives: 'Where it lives',
  shortlist: 'Shortlist',
  control: 'Which control, if any',
  taughtIn: 'Taught in',
} as const

/**
 * Reading the view, as one table wherever it appears: the Reference's full table and the excerpt a
 * lesson highlights (fellow walkthrough A10). Both read the same `BRONCH_GRAMMAR` rows through this
 * one renderer, so the observation, where the problem lives, the shortlist and the control stay in
 * one row, under their headings, on every surface — the lesson excerpt had become loose lines in
 * which a control ("Suction") read like the next observation.
 *
 * Each observation is the row's header, so a screen reader announces it with every cell. In a
 * narrow container the same table stacks into one card per row, each cell under its own visible
 * label; the explicit table roles keep the row and column relationships when the cells are laid
 * out as blocks, and the visible labels are hidden from assistive technology, which already has the
 * column headers.
 */
export function ReadingTheViewTable({
  rows,
  labelledBy,
  taughtIn,
}: {
  readonly rows: readonly GrammarRow[]
  /** The id of the visible heading that names this table. */
  readonly labelledBy: string
  /** The Reference's extra column: where each row is taught. */
  readonly taughtIn?: (row: GrammarRow) => ReactNode
}) {
  return (
    <div className={styles.wrap}>
      <table role="table" className={styles.table} aria-labelledby={labelledBy} data-grammar>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">
              {COLUMNS.see}
            </th>
            <th role="columnheader" scope="col">
              {COLUMNS.lives}
            </th>
            <th role="columnheader" scope="col">
              {COLUMNS.shortlist}
            </th>
            <th role="columnheader" scope="col">
              {COLUMNS.control}
            </th>
            {taughtIn ? (
              <th role="columnheader" scope="col">
                {COLUMNS.taughtIn}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => (
            <tr key={row.id} role="row" data-grammar-row={row.id}>
              <th role="rowheader" scope="row" data-grammar-cell="see">
                <CellLabel>{COLUMNS.see}</CellLabel>
                {row.see}
              </th>
              <td role="cell" data-grammar-cell="lives">
                <CellLabel>{COLUMNS.lives}</CellLabel>
                {row.lives}
              </td>
              <td role="cell" data-grammar-cell="shortlist">
                <CellLabel>{COLUMNS.shortlist}</CellLabel>
                <ul className={styles.shortlist}>
                  {row.shortlist.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </td>
              <td role="cell" data-grammar-cell="control">
                <CellLabel>{COLUMNS.control}</CellLabel>
                {grammarRowControl(row)}
              </td>
              {taughtIn ? (
                <td role="cell" data-grammar-cell="taught-in">
                  <CellLabel>{COLUMNS.taughtIn}</CellLabel>
                  {taughtIn(row)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CellLabel({ children }: { readonly children: ReactNode }) {
  return (
    <span className={styles.cellLabel} aria-hidden="true" data-grammar-cell-label>
      {children}
    </span>
  )
}
