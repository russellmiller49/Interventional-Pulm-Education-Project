'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'

import type { SupportMode } from '../../engine/types'
import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect'
import {
  CapstoneMatrixCellBody,
  rowQuotesGrammar,
  type CapstoneMatrixCell,
} from './capstoneGrammarCell'
import styles from './CapstoneHypothesisMatrix.module.css'

export interface CapstoneMatrixHypothesis<H extends string> {
  readonly id: H
  readonly label: string
  /** The mechanism in a sentence, printed under the column heading where a panel authors one. */
  readonly mechanism?: string
}

export interface CapstoneMatrixRowView<H extends string> {
  readonly id: string
  readonly label: string
  /** What the loaded case shows for this row, read from the live state by the panel. */
  readonly live: { readonly text: string; readonly reason?: string }
  readonly cells: Readonly<Record<H, CapstoneMatrixCell>>
}

/*
 * Widths, in rem, that a full table needs to be read without breaking words: the row heading, the
 * live column, and each explanation column. Rem so that enlarged text asks for more room.
 */
const ROW_HEADING_REM = 10
const LIVE_COLUMN_REM = 9
const HYPOTHESIS_COLUMN_REM = 9.5

export function capstoneMatrixMinimumRem(shownColumns: number): number {
  return ROW_HEADING_REM + LIVE_COLUMN_REM + shownColumns * HYPOTHESIS_COLUMN_REM
}

/**
 * The capstones' comparison of competing explanations, readable at any width.
 *
 * A fellow walkthrough (S17-1, S17-2, VA17-1) found the VV matrix — 1,024 px wide — inside a 366 px
 * teaching column at 1280 wide, showing one of its four explanation columns with the sideways
 * scrollbar 3,500 px further down, and the VA matrix (seven columns) the same, 5,400 px tall; about
 * 1,600 words sat between the task and its first question.
 *
 * Every explanation, row, live value, limitation and reason is still here, in the same table
 * semantics. What changed:
 *
 * - Layout follows the room the matrix actually has. Where every shown column fits at a readable
 *   width it is a table; where it does not, each signal becomes a card that lists what each shown
 *   explanation predicts for it, each value named by its explanation. Nothing scrolls sideways.
 * - The learner chooses which explanations to compare. All are shown to start with; any can be
 *   hidden and brought back in any order, so two can be compared side by side or one read alone.
 *   Nothing is locked, ordered, or gated on an answer.
 * - The short expected direction in each cell leads. Why that row separates the explanations is one
 *   toggle away, for the whole matrix at once, and every limitation stays visible — a limitation is
 *   part of reading the cell, not detail.
 *
 * Hidden columns and collapsed reasoning stay in the DOM (`hidden`), so the rendered text scans and
 * the sentence equivalents under the matrix still see all of it.
 */
export function CapstoneHypothesisMatrix<H extends string>({
  idPrefix,
  caption,
  hypotheses,
  rows,
  supportMode,
}: {
  readonly idPrefix: string
  readonly caption: string
  readonly hypotheses: readonly CapstoneMatrixHypothesis<H>[]
  readonly rows: readonly CapstoneMatrixRowView<H>[]
  readonly supportMode: SupportMode
}) {
  const [hidden, setHidden] = useState<ReadonlySet<H>>(() => new Set())
  const [reasoningShown, setReasoningShown] = useState(false)
  const [layout, setLayout] = useState<'table' | 'cards'>('table')
  const scrollerRef = useRef<HTMLDivElement>(null)
  const shown = hypotheses.filter((hypothesis) => !hidden.has(hypothesis.id))
  const minimumRem = capstoneMatrixMinimumRem(shown.length)

  const measure = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller || typeof window === 'undefined') return
    const available = scroller.clientWidth
    if (!(available > 0)) return
    const rootPx = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16
    const next = available >= minimumRem * rootPx ? 'table' : 'cards'
    setLayout((current) => (current === next ? current : next))
  }, [minimumRem])

  useIsomorphicLayoutEffect(() => {
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const scroller = scrollerRef.current
    if (!scroller) return undefined
    const observer = new ResizeObserver(() => measure())
    observer.observe(scroller)
    // A font change can change the required width without changing the container width.
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [measure])

  function toggle(id: H) {
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (hypotheses.length - next.size > 1) next.add(id)
      return next
    })
  }

  const filterId = `${idPrefix}-matrix-filter`
  return (
    <div className={styles.matrix} data-capstone-matrix={idPrefix}>
      <div className={styles.controls}>
        <div role="group" aria-labelledby={filterId} data-hypothesis-filter>
          <p id={filterId} className={styles.controlsLabel}>
            Explanations to compare
            <span className={styles.controlsHint}>
              {' '}
              · all shown to start; press one to hide or show it
            </span>
          </p>
          <div className={styles.filterButtons}>
            {hypotheses.map((hypothesis) => {
              const on = !hidden.has(hypothesis.id)
              return (
                <button
                  key={hypothesis.id}
                  type="button"
                  className={styles.filterButton}
                  aria-pressed={on}
                  // The last shown explanation cannot be hidden: an empty matrix compares nothing.
                  aria-disabled={on && shown.length === 1 ? true : undefined}
                  data-hypothesis-toggle={hypothesis.id}
                  onClick={() => toggle(hypothesis.id)}
                >
                  {hypothesis.label}
                </button>
              )
            })}
            {
              <button
                type="button"
                className={styles.filterReset}
                data-hypothesis-show-all
                aria-disabled={hidden.size === 0 || undefined}
                onClick={() => {
                  if (hidden.size > 0) setHidden(new Set())
                }}
              >
                Show all {hypotheses.length}
              </button>
            }
          </div>
        </div>
        <button
          type="button"
          className={styles.reasoningToggle}
          aria-pressed={reasoningShown}
          data-matrix-reasoning-toggle
          onClick={() => setReasoningShown((current) => !current)}
        >
          {reasoningShown ? 'Hide why each row separates them' : 'Show why each row separates them'}
        </button>
      </div>
      <p className={styles.status} role="status" data-matrix-status>
        Comparing {shown.length} of {hypotheses.length} explanations
        {layout === 'cards' ? ', one signal per card' : ''}.
      </p>
      <div
        ref={scrollerRef}
        className={`overflow-x-auto ${styles.scroller}`}
        data-matrix-layout={layout}
      >
        <table
          className={`w-full text-left text-sm ${styles.table}`}
          data-hypothesis-matrix
          data-shown-columns={shown.length}
          data-reasoning={reasoningShown ? 'shown' : 'collapsed'}
          style={layout === 'table' ? { minWidth: `${minimumRem}rem` } : undefined}
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="pb-1 pr-3 align-bottom font-semibold">
                Signal
              </th>
              <th scope="col" className="pb-1 pr-3 align-bottom font-semibold">
                In this case now
              </th>
              {hypotheses.map((hypothesis) => (
                <th
                  key={hypothesis.id}
                  scope="col"
                  className="pb-1 pr-3 align-bottom font-semibold"
                  data-hypothesis-column={hypothesis.id}
                  hidden={hidden.has(hypothesis.id) || undefined}
                >
                  <span className="block">{hypothesis.label}</span>
                  {hypothesis.mechanism ? (
                    <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                      {hypothesis.mechanism}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-matrix-row={row.id} className="align-top">
                <th scope="row" className="py-2 pr-3 font-medium">
                  {row.label}
                </th>
                <td
                  className="py-2 pr-3"
                  data-live-finding={row.id}
                  data-column-label="In this case now"
                >
                  {row.live.text}
                  {row.live.reason ? (
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {row.live.reason}
                    </span>
                  ) : null}
                </td>
                {hypotheses.map((hypothesis) => (
                  <td
                    key={hypothesis.id}
                    className="py-2 pr-3"
                    data-matrix-cell={`${row.id}:${hypothesis.id}`}
                    data-column-label={hypothesis.label}
                    hidden={hidden.has(hypothesis.id) || undefined}
                  >
                    <CapstoneMatrixCellBody
                      cell={row.cells[hypothesis.id]}
                      supportMode={supportMode}
                      outsideGrammar={rowQuotesGrammar(row.cells)}
                      reasoningShown={reasoningShown}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * The matrix's sentence equivalents, folded under it.
 *
 * They say what the table says, one explanation per paragraph, for a reader who wants it as prose.
 * With the table itself exposed as a table they repeat it word for word, so they are a disclosure
 * rather than a second copy in the default read (S17-2). The text is unchanged and stays in the DOM.
 */
export function CapstoneMatrixSentences({ children }: { readonly children: ReactNode }) {
  return (
    <details className={styles.sentences} data-matrix-sentences>
      <summary>Read the same comparison as sentences</summary>
      {children}
    </details>
  )
}
