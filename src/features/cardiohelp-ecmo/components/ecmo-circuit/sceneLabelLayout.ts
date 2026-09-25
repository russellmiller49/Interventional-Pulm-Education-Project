/** Optional screen-space labels: keep their projected anchors, fit whole pills within the canvas,
 * and reject collisions (including leaders). The keyboard finder can isolate any rejected label. */

export interface SceneLabelBox {
  readonly id: string
  /** Anchor in canvas pixels: the point the leader ends on. */
  readonly x: number
  readonly y: number
  /** The pill's own size in pixels. */
  readonly width: number
  readonly height: number
}

export interface SceneRect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

export interface SceneLabelPlacement {
  readonly side: 'above' | 'below'
  /** Leader length in pixels, anchor to the pill's near edge. */
  readonly leader: number
  /** Vertical offset of the pill's centre from its anchor, in pixels (negative is up). */
  readonly offsetY: number
  readonly offsetX: number
  /** False when no truthful, non-overlapping placement fits; the finder still exposes its name. */
  readonly visible: boolean
}

export interface SceneLabelLayoutOptions {
  readonly priorityIds?: readonly string[]
  /** Overlays drawn over the canvas that a pill must not sit under. */
  readonly obstacles?: readonly SceneRect[]
  /** The canvas size; a pill must stay inside it. */
  readonly bounds?: { readonly width: number; readonly height: number }
  /** The resting leader length in pixels. */
  readonly restingLeader?: number
  readonly gap?: number
  readonly maxShift?: number
}

/** Clear space kept between two pills, and between a pill and an overlay. */
export const SCENE_LABEL_GAP_PX = 4
/** A leader longer than this stops reading as belonging to its object. */
export const SCENE_LABEL_MAX_SHIFT_PX = 180

const intersects = (a: SceneRect, b: SceneRect, gap: number) =>
  a.left < b.right + gap &&
  a.right > b.left - gap &&
  a.top < b.bottom + gap &&
  a.bottom > b.top - gap

type Segment = { x1: number; y1: number; x2: number; y2: number }
function crossing(a: Segment, b: Segment): boolean {
  const side = (x: number, y: number, line: Segment) =>
    (line.x2 - line.x1) * (y - line.y1) - (line.y2 - line.y1) * (x - line.x1)
  return (
    side(b.x1, b.y1, a) * side(b.x2, b.y2, a) < 0 && side(a.x1, a.y1, b) * side(a.x2, a.y2, b) < 0
  )
}
function throughRect(line: Segment, rect: SceneRect): boolean {
  const { left, right, top, bottom } = rect
  const inside = (x: number, y: number) => x > left && x < right && y > top && y < bottom
  return (
    inside(line.x1, line.y1) ||
    inside(line.x2, line.y2) ||
    crossing(line, { x1: left, y1: top, x2: right, y2: top }) ||
    crossing(line, { x1: right, y1: top, x2: right, y2: bottom }) ||
    crossing(line, { x1: right, y1: bottom, x2: left, y2: bottom }) ||
    crossing(line, { x1: left, y1: bottom, x2: left, y2: top })
  )
}

/**
 * Where each pill goes. A pill with nothing in the way rests above its anchor on the resting
 * leader; otherwise it takes the shorter clear shift, up or down, that keeps it inside the canvas.
 * When no position fits, hide the optional overlay rather than draw a clipped or overlapping label.
 * All names remain in the keyboard finder; an explicit selection restores the overview and shows
 * just that label. Horizontal shifts retain a leader to the original projected anchor.
 */
export function placeSceneLabels(
  boxes: readonly SceneLabelBox[],
  {
    priorityIds = [],
    obstacles = [],
    bounds,
    restingLeader = 14,
    gap = SCENE_LABEL_GAP_PX,
    maxShift = SCENE_LABEL_MAX_SHIFT_PX,
  }: SceneLabelLayoutOptions = {},
): Map<string, SceneLabelPlacement> {
  const priority = new Set(priorityIds)
  const order = [...boxes].sort((a, b) => {
    const rank = Number(priority.has(b.id)) - Number(priority.has(a.id))
    if (rank !== 0) return rank
    if (b.y !== a.y) return b.y - a.y
    return a.id.localeCompare(b.id)
  })
  const placed: SceneRect[] = [...obstacles]
  const leaders: Segment[] = []
  const placements = new Map<string, SceneLabelPlacement>()

  for (const box of order) {
    const left = bounds
      ? Math.max(gap, Math.min(box.x - box.width / 2, bounds.width - gap - box.width))
      : box.x - box.width / 2
    const right = left + box.width
    const offsetX = left + box.width / 2 - box.x
    const rect = (side: 'above' | 'below', shift: number): SceneRect => {
      const top =
        side === 'above'
          ? box.y - restingLeader - shift - box.height
          : box.y + restingLeader + shift
      return { left, right, top, bottom: top + box.height }
    }
    const line = (candidate: SceneRect, side: 'above' | 'below'): Segment => ({
      x1: (candidate.left + candidate.right) / 2,
      y1: side === 'above' ? candidate.bottom : candidate.top,
      x2: box.x,
      y2: box.y,
    })
    const clearShift = (side: 'above' | 'below') => {
      for (let shift = 0; shift <= maxShift; shift += gap || 1) {
        const candidate = rect(side, shift)
        const leaderLine = line(candidate, side)
        const inside =
          !bounds ||
          (candidate.top >= gap &&
            candidate.bottom <= bounds.height - gap &&
            left >= gap &&
            right <= bounds.width - gap &&
            box.x >= gap &&
            box.x <= bounds.width - gap &&
            box.y >= gap &&
            box.y <= bounds.height - gap)
        if (
          inside &&
          !placed.some(
            (other) => intersects(candidate, other, gap) || throughRect(leaderLine, other),
          ) &&
          !leaders.some((other) => throughRect(other, candidate) || crossing(leaderLine, other))
        ) {
          return { side, shift, inside: true }
        }
      }
      return { side, shift: maxShift, inside: false }
    }

    const above = clearShift('above')
    const below = clearShift('below')
    let choice = above
    if (!(above.inside && above.shift === 0)) {
      if (above.inside && below.inside) choice = below.shift < above.shift ? below : above
      else if (below.inside) choice = below
      else if (!above.inside) choice = below.shift < above.shift ? below : above
    }
    const shift = Math.min(choice.shift, maxShift)
    const leader = restingLeader + shift
    const offsetY = choice.side === 'above' ? -(leader + box.height / 2) : leader + box.height / 2
    const visible = choice.inside
    if (visible) {
      const candidate = rect(choice.side, shift)
      placed.push(candidate)
      leaders.push(line(candidate, choice.side))
    }
    placements.set(box.id, { side: choice.side, leader, offsetY, offsetX, visible })
  }
  return placements
}
