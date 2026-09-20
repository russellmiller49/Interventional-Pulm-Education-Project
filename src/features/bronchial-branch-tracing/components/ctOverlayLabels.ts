/**
 * Screen-space placement for the CT overlay labels.
 *
 * The anchor of an overlay — the ring or crosshair drawn at `point` — is the
 * projected native coordinate and never moves here. Only the text is relocated,
 * and a leader line is drawn back to the anchor so the pairing stays explicit.
 * Nothing in this file infers a lumen, a wall or a boundary.
 */
export interface LabelAnchor {
  id: string
  /** Projected position in the viewer's 0–100 user-unit space. */
  point: [number, number]
  text: string
}

export interface PlacedLabel extends LabelAnchor {
  /** Where the text is drawn, in the same 0–100 user-unit space. */
  x: number
  y: number
  textAnchor: 'start' | 'end'
  /** Where the leader line meets the text. */
  leader: [number, number]
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

/** Rough advance width of the viewer's label font, in user units per character. */
const WIDTH_PER_CHARACTER = 0.62

/**
 * Place each label on the side of the image away from its anchor, then push
 * labels whose boxes would collide further down. Returns them in the input order
 * so callers keep their own identities.
 */
export function placeOverlayLabels(
  anchors: LabelAnchor[],
  {
    fontSize = 3.4,
    gap = 6,
    margin = 4,
  }: { fontSize?: number; gap?: number; margin?: number } = {},
): PlacedLabel[] {
  const lineHeight = fontSize * 1.3
  const placed = anchors.map((anchor) => {
    const toLeft = anchor.point[0] > 50
    const x = clamp(anchor.point[0] + (toLeft ? -gap : gap), margin, 100 - margin)
    return {
      ...anchor,
      x,
      y: clamp(anchor.point[1] + fontSize * 0.35, margin + fontSize, 100 - margin),
      textAnchor: (toLeft ? 'end' : 'start') as 'start' | 'end',
      leader: [0, 0] as [number, number],
    }
  })
  const width = (label: (typeof placed)[number]) =>
    label.text.length * fontSize * WIDTH_PER_CHARACTER
  const span = (label: (typeof placed)[number]): [number, number] =>
    label.textAnchor === 'end'
      ? [label.x - width(label), label.x]
      : [label.x, label.x + width(label)]
  // One pass top to bottom: a label that would sit on top of one already placed
  // moves down, whichever side of the image each of them is on.
  const order = [...placed].sort((a, b) => a.y - b.y)
  for (let i = 1; i < order.length; i++) {
    const current = order[i]
    for (let j = 0; j < i; j++) {
      const earlier = order[j]
      const [aLeft, aRight] = span(earlier)
      const [bLeft, bRight] = span(current)
      const horizontal = aLeft < bRight && bLeft < aRight
      if (horizontal && current.y - earlier.y < lineHeight) current.y = earlier.y + lineHeight
    }
  }
  // Pushing down can run past the bottom edge; recover by lifting the whole set.
  const lowest = order[order.length - 1]
  if (lowest && lowest.y > 100 - margin) {
    const lift = lowest.y - (100 - margin)
    for (const label of order) label.y = Math.max(margin + fontSize, label.y - lift)
  }
  // The leader ends at the text's final position, so the pairing stays readable
  // after the collision pass has moved it.
  for (const label of placed)
    label.leader = [label.x + (label.textAnchor === 'end' ? 1.2 : -1.2), label.y - fontSize * 0.32]
  return placed
}
