/**
 * Screen-space layout for the labels of a waveform figure.
 *
 * A label drawn at its landmark, in the figure's own units, is as large as the figure is wide and
 * sits wherever the trace put it: three landmarks a tenth of a beat apart wrote three labels over
 * one another and over the segment they describe (reports L3-01, L3-06). Labels are laid out here
 * instead in the pixels they will occupy — in a track outside the plot, one after another along it,
 * pushed apart until none touches its neighbour, spilling to a second track when one cannot hold
 * them — and each keeps a leader line back to its own landmark.
 *
 * Pure: the same measured width and text size give the same layout, so it can be tested without a
 * browser and the browser can be tested against it.
 */

export interface LabelRequest {
  readonly id: string
  /** Where the landmark is along the plot, in pixels from the plot's left edge. */
  readonly anchorPx: number
  /** The label's width in pixels. */
  readonly widthPx: number
}

export interface PlacedLabel {
  readonly id: string
  /** The label's left edge, in pixels from the plot's left edge. */
  readonly leftPx: number
  readonly widthPx: number
  /** 0 is the track nearest the plot. */
  readonly row: number
}

export interface LabelLayout {
  readonly labels: readonly PlacedLabel[]
  readonly rows: number
}

/** A width for a run of bold italic label text, generous enough that the estimate never overlaps. */
export function estimateLabelWidthPx(text: string, fontSizePx: number): number {
  return Math.ceil(text.length * fontSizePx * 0.62 + fontSizePx * 0.9)
}

function placeRow(
  requests: readonly LabelRequest[],
  availablePx: number,
  gapPx: number,
): { leftPx: number }[] {
  const positions = requests.map((request) => ({
    leftPx: Math.max(
      0,
      Math.min(availablePx - request.widthPx, request.anchorPx - request.widthPx / 2),
    ),
  }))
  // Left to right: no label starts before its neighbour ends.
  for (let index = 1; index < positions.length; index += 1) {
    positions[index].leftPx = Math.max(
      positions[index].leftPx,
      positions[index - 1].leftPx + requests[index - 1].widthPx + gapPx,
    )
  }
  // Right to left: pull the run back inside the plot's right edge.
  for (let index = positions.length - 1; index >= 0; index -= 1) {
    const limit =
      index === positions.length - 1
        ? availablePx - requests[index].widthPx
        : positions[index + 1].leftPx - gapPx - requests[index].widthPx
    positions[index].leftPx = Math.min(positions[index].leftPx, limit)
  }
  return positions
}

/**
 * Places labels in as few tracks as hold them without overlap.
 *
 * Labels keep their left-to-right order. When one track is too short for the whole run they are
 * dealt alternately across the tracks, so neighbours — the ones that would collide — are separated
 * first.
 */
export function layoutLabels(
  requests: readonly LabelRequest[],
  availablePx: number,
  gapPx = 8,
): LabelLayout {
  if (requests.length === 0) return { labels: [], rows: 0 }
  const ordered = [...requests].sort((left, right) => left.anchorPx - right.anchorPx)
  const fits = (rows: number) => {
    for (let row = 0; row < rows; row += 1) {
      const inRow = ordered.filter((_, index) => index % rows === row)
      const needed =
        inRow.reduce((total, request) => total + request.widthPx, 0) + gapPx * (inRow.length - 1)
      if (needed > availablePx) return false
    }
    return true
  }
  let rows = 1
  while (rows < ordered.length && !fits(rows)) rows += 1
  const labels: PlacedLabel[] = []
  for (let row = 0; row < rows; row += 1) {
    const inRow = ordered.filter((_, index) => index % rows === row)
    const positions = placeRow(inRow, availablePx, gapPx)
    inRow.forEach((request, index) => {
      labels.push({
        id: request.id,
        leftPx: positions[index].leftPx,
        widthPx: request.widthPx,
        row,
      })
    })
  }
  return { labels, rows }
}
