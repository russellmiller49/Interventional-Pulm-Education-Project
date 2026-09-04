import { resolveEcmoModeText } from '../../content/circuitSegments'
import { ecmoLocalizationRow, type EcmoLocalizationRowId } from '../../content/localizationCards'
import type { SupportMode } from '../../engine/types'

/**
 * How the two integration capstones quote the diagnostic grammar instead of restating it.
 *
 * Two of the explanations each capstone matrix holds apart — the membrane and the gas path — are
 * rows of the four-row grammar in `localizationCards.ts`, and the three pressure rows of the matrix
 * (pVen, pInt and pArt, the gradient) are where that grammar speaks. The matrices used to carry
 * their own sentence in every one of those cells: "they separate: pInt rises while pArt does not
 * follow it" beside a lesson that had taught "the pre-membrane pressure separates from the return
 * pressure; the gradient widens". Same rule, different words, and a learner cannot tell a paraphrase
 * from a new rule. So a cell in a pressure row that belongs to a grammar row names the row, and its
 * direction text is the row's own signature, read from the registry at render. The remaining
 * columns in those rows — recirculation, the patient, and the VA-only mechanisms — are not pressure
 * patterns the grammar carries, and their cells say so beside their authored text.
 */

export interface AuthoredMatrixCell {
  /** Expected direction, stated as a direction rather than a value. */
  readonly direction: string
  /** What makes this row useful for telling this explanation from the others. */
  readonly discriminator: string
  /** Where this simulation, or the supplied sources, cannot support the expectation. */
  readonly limitation?: string
}

export interface GrammarRowMatrixCell {
  /** The grammar row whose signature is this cell's direction text. */
  readonly grammarRowId: EcmoLocalizationRowId
  readonly discriminator: string
  readonly limitation?: string
}

export type CapstoneMatrixCell = AuthoredMatrixCell | GrammarRowMatrixCell

export function isGrammarRowCell(cell: CapstoneMatrixCell): cell is GrammarRowMatrixCell {
  return 'grammarRowId' in cell
}

/** A row quotes the grammar when any of its cells does; its other cells are then marked as outside it. */
export function rowQuotesGrammar<H extends string>(
  cells: Readonly<Record<H, CapstoneMatrixCell>>,
): boolean {
  return Object.values<CapstoneMatrixCell>(cells).some(isGrammarRowCell)
}

export const GRAMMAR_ROW_REFERENCE = 'Grammar row'
export const OUTSIDE_GRAMMAR_NOTE = 'Not a pressure pattern in the grammar.'

/** The row's signature sentence, resolved for the track the panel teaches. */
export function grammarRowSignature(
  rowId: EcmoLocalizationRowId,
  supportMode: SupportMode,
): string {
  return resolveEcmoModeText(ecmoLocalizationRow(rowId).signature, supportMode)
}

/** The direction a cell states, in one string. */
export function matrixCellDirection(cell: CapstoneMatrixCell, supportMode: SupportMode): string {
  if (!isGrammarRowCell(cell)) return cell.direction
  const row = ecmoLocalizationRow(cell.grammarRowId)
  return `${GRAMMAR_ROW_REFERENCE}, ${row.label}: ${grammarRowSignature(row.id, supportMode)}`
}

/**
 * The direction for a text equivalent: what the cell states, plus the outside-grammar note where the
 * row quotes the grammar and this cell does not, so a reader of the equivalent is told what the
 * table says.
 */
export function matrixCellEquivalent<H extends string>(
  cells: Readonly<Record<H, CapstoneMatrixCell>>,
  hypothesisId: H,
  supportMode: SupportMode,
): string {
  const cell = cells[hypothesisId]
  const direction = matrixCellDirection(cell, supportMode)
  return rowQuotesGrammar(cells) && !isGrammarRowCell(cell)
    ? `${direction} ${OUTSIDE_GRAMMAR_NOTE}`
    : direction
}

/** One matrix cell's body: the direction, quoted or authored; the discriminator; any limitation. */
export function CapstoneMatrixCellBody({
  cell,
  supportMode,
  outsideGrammar,
}: {
  readonly cell: CapstoneMatrixCell
  readonly supportMode: SupportMode
  /** Whether this row quotes the grammar, so an authored cell in it is marked as outside it. */
  readonly outsideGrammar: boolean
}) {
  return (
    <>
      {isGrammarRowCell(cell) ? (
        <span className="block" data-cell-direction data-grammar-row={cell.grammarRowId}>
          <span
            className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            data-grammar-row-reference
          >
            {GRAMMAR_ROW_REFERENCE} · {ecmoLocalizationRow(cell.grammarRowId).label}
          </span>
          <span className="block" data-grammar-row-signature>
            {grammarRowSignature(cell.grammarRowId, supportMode)}
          </span>
        </span>
      ) : (
        <>
          <span className="block" data-cell-direction>
            {cell.direction}
          </span>
          {outsideGrammar ? (
            <span
              className="mt-1 block text-xs italic leading-5 text-muted-foreground"
              data-outside-grammar
            >
              {OUTSIDE_GRAMMAR_NOTE}
            </span>
          ) : null}
        </>
      )}
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
        {cell.discriminator}
      </span>
      {cell.limitation ? (
        <span className="mt-1 block text-xs leading-5" data-cell-limitation>
          <span className="font-semibold">Limitation. </span>
          {cell.limitation}
        </span>
      ) : null}
    </>
  )
}
