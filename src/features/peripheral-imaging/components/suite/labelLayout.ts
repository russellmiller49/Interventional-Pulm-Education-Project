/**
 * Where the scene's DOM labels go, in viewport pixels.
 *
 * Report 2.4 and 2.5 (fellow walkthrough, PDF p.17/p.18/p.25). The six component labels used to be
 * parked in two fixed columns at the edges of the figure, joined to their objects by leaders that
 * crossed the whole scene: the "X-ray tube" label sat top-left while the tube is under the table,
 * and was read as the box above the patient. In the beam's-eye view, where every component lies on
 * one line of sight, all six were drawn at the same point. "Tool tip" and "Authored target" were
 * offset in world space, so from most angles one printed over the other.
 *
 * Every label now starts beside the projected position of the object it names, on the side of the
 * figure that object is on, and is then moved — vertically first, the way a reader scans a column
 * of callouts — only as far as it must be to clear the labels around it and stay inside the
 * figure. The object never moves; a label that has to sit away from its object keeps a leader to
 * it. Pure, so the rule is tested without a WebGL context.
 */

export interface LabelRequest {
  readonly id: string
  /** The object's projected position in the figure, in pixels from its top-left corner. */
  readonly anchor: readonly [number, number]
  readonly width: number
  readonly height: number
  /**
   * `side` puts the label beside its anchor, on the anchor's own half of the figure.
   * `above-left` / `below-right` are for two objects that can coincide on screen: they leave in
   * opposite directions, so they are apart before any collision is resolved.
   */
  readonly placement: 'side' | 'above-left' | 'below-right'
  /** The clear distance between the anchor and the nearest edge of its label. */
  readonly gap: number
}

export interface PlacedLabel {
  readonly id: string
  /** The label's centre. */
  readonly x: number
  readonly y: number
  /** How far the nearest edge of the label ended up from its anchor. */
  readonly distance: number
}

const PAD = 6
const CLEARANCE = 4

function clamp(value: number, min: number, max: number) {
  return max < min ? (min + max) / 2 : Math.min(max, Math.max(min, value))
}

function overlap(a: Box, b: Box) {
  const x = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)
  const y = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2)
  return x > -CLEARANCE && y > -CLEARANCE ? { x: x + CLEARANCE, y: y + CLEARANCE } : null
}

interface Box {
  x: number
  y: number
  readonly w: number
  readonly h: number
}

export function placeLabels(
  requests: readonly LabelRequest[],
  width: number,
  height: number,
): readonly PlacedLabel[] {
  if (requests.length === 0 || width <= 0 || height <= 0) return []
  const sides = requests.filter((request) => request.placement === 'side')
  const middle = sides.length
    ? sides.reduce((sum, request) => sum + request.anchor[0], 0) / sides.length
    : width / 2
  const boxes: Box[] = requests.map((request, index) => {
    const [ax, ay] = request.anchor
    const reach = request.gap + request.width / 2
    let x = ax
    let y = ay
    if (request.placement === 'side') {
      // Objects on one line of sight share an x; alternate them so they do not all pick one side.
      const left = Math.abs(ax - middle) < 1 ? index % 2 === 0 : ax < middle
      x = ax + (left ? -reach : reach)
    } else if (request.placement === 'above-left') {
      x = ax - reach
      y = ay - request.gap - request.height / 2
    } else {
      x = ax + reach
      y = ay + request.gap + request.height / 2
    }
    return { x, y, w: request.width, h: request.height }
  })
  const contain = () => {
    for (const box of boxes) {
      box.x = clamp(box.x, PAD + box.w / 2, width - PAD - box.w / 2)
      box.y = clamp(box.y, PAD + box.h / 2, height - PAD - box.h / 2)
    }
  }
  contain()
  for (let pass = 0; pass < 24; pass++) {
    let moved = false
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const hit = overlap(a, b)
        if (!hit) continue
        moved = true
        // Separate along the axis that needs the smaller move, preferring the vertical one: the
        // labels beside a tall piece of equipment read as a column.
        if (hit.y <= hit.x * 1.5) {
          const upper = a.y <= b.y ? a : b
          const lower = upper === a ? b : a
          upper.y -= hit.y / 2
          lower.y += hit.y / 2
        } else {
          const first = a.x <= b.x ? a : b
          const second = first === a ? b : a
          first.x -= hit.x / 2
          second.x += hit.x / 2
        }
      }
    contain()
    if (!moved) break
  }
  return requests.map((request, index) => {
    const box = boxes[index]
    const dx = Math.max(0, Math.abs(request.anchor[0] - box.x) - box.w / 2)
    const dy = Math.max(0, Math.abs(request.anchor[1] - box.y) - box.h / 2)
    return { id: request.id, x: box.x, y: box.y, distance: Math.hypot(dx, dy) }
  })
}

/** Whether any two placed labels still overlap; the figure is only correct when none do. */
export function labelsOverlap(
  requests: readonly LabelRequest[],
  placed: readonly PlacedLabel[],
): boolean {
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const x =
        Math.min(placed[i].x + requests[i].width / 2, placed[j].x + requests[j].width / 2) -
        Math.max(placed[i].x - requests[i].width / 2, placed[j].x - requests[j].width / 2)
      const y =
        Math.min(placed[i].y + requests[i].height / 2, placed[j].y + requests[j].height / 2) -
        Math.max(placed[i].y - requests[i].height / 2, placed[j].y - requests[j].height / 2)
      if (x > 0 && y > 0) return true
    }
  return false
}
