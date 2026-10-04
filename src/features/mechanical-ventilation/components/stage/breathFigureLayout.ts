/**
 * Row geometry shared by the captured-breath figure and the overlay, so the two draw alike.
 *
 * A row is its label, then a 59-px plot. The label is SVG text at a fixed 13 px, so it cannot wrap
 * by itself: a label that names its origin in full ("Volume from first inspiratory sample (mL)")
 * is wider than a phone-width figure. When any row's label does not fit the measured width, every
 * row gets a second label line — one pitch for the whole figure — and the label is split at the
 * space that balances the two lines. Nothing about the plot, its scale or its time axis changes.
 */

/** Generous average advance of 13-px system-ui text, so a label is wrapped before it can spill. */
const LABEL_CHAR_PX = 7
const LABEL_LINE_PX = 15
const SINGLE_LINE_PITCH = 85
const SINGLE_LINE_PLOT_TOP = 15

export interface BreathRowLayout {
  /** Each row's label, as one or two lines. */
  readonly labels: readonly (readonly string[])[]
  /** Vertical distance from one row to the next. */
  readonly pitch: number
  /** Offset of the plot inside its row, below the label. */
  readonly plotTop: number
  /** Height of all rows together; the time ticks sit under it. */
  readonly rowsHeight: number
}

function splitBalanced(label: string): readonly string[] {
  const words = label.split(' ')
  let best: readonly string[] = [label]
  let bestLongest = label.length
  for (let i = 1; i < words.length; i += 1) {
    const first = words.slice(0, i).join(' ')
    const second = words.slice(i).join(' ')
    const longest = Math.max(first.length, second.length)
    if (longest < bestLongest) {
      best = [first, second]
      bestLongest = longest
    }
  }
  return best
}

export function breathRowLayout(rowLabels: readonly string[], width: number): BreathRowLayout {
  const wraps = rowLabels.some((label) => label.length * LABEL_CHAR_PX > width)
  const extra = wraps ? LABEL_LINE_PX : 0
  const pitch = SINGLE_LINE_PITCH + extra
  return {
    labels: rowLabels.map((label) =>
      wraps && label.length * LABEL_CHAR_PX > width ? splitBalanced(label) : [label],
    ),
    pitch,
    plotTop: SINGLE_LINE_PLOT_TOP + extra,
    rowsHeight: rowLabels.length * pitch,
  }
}

export const BREATH_LABEL_LINE_PX = LABEL_LINE_PX
