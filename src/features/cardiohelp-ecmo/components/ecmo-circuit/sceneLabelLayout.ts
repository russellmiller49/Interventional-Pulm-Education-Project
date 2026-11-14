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
  /** On a rail: 0 for the row against the canvas edge, 1 for the second row inside it. */
  readonly row?: 0 | 1
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

/* ------------------------------------------------------------------ *
 * Rails: the overview's labels, off the model
 * ------------------------------------------------------------------ */

export interface SceneLabelRailOptions {
  readonly priorityIds?: readonly string[]
  readonly obstacles?: readonly SceneRect[]
  /** The canvas size. Rails run along its top and bottom edges. */
  readonly bounds: { readonly width: number; readonly height: number }
  /** Clear space between pills, and between a pill and the canvas edge. */
  readonly gap?: number
  /** The shortest leader worth drawing: a pill never sits closer than this to its object. */
  readonly minLeader?: number
}

/** Clear space between two pills on a rail. Wider than the stacked gap: they sit side by side. */
export const SCENE_LABEL_RAIL_GAP_PX = 6

interface RailItem {
  readonly box: SceneLabelBox
  left: number
}

/** Lay one rail's pills left to right, each as near its object as the others allow. */
function spreadAlongRail(items: RailItem[], width: number, gap: number): void {
  items.sort((a, b) => a.box.x - b.box.x || a.box.id.localeCompare(b.box.id))
  let cursor = gap
  for (const item of items) {
    const wanted = item.box.x - item.box.width / 2
    item.left = Math.max(cursor, Math.min(wanted, width - gap - item.box.width))
    cursor = item.left + item.box.width + gap
  }
  // The pass above only pushes right. Pull back from the right edge whatever ran past it.
  let limit = width - gap
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    item.left = Math.min(item.left, limit - item.box.width)
    limit = item.left - gap
  }
}

const railWidth = (items: readonly RailItem[], gap: number) =>
  items.reduce((total, item) => total + item.box.width + gap, gap)

/**
 * The overview's labels in two rails, along the top and the bottom of the view.
 *
 * Resting on its object, every pill covered part of the model it named: eight pills over a scene
 * that took the middle of the pane hid the patient's groin and the pump head (learner review,
 * November 2026). Here no pill is on the model. Each goes to the rail nearer its object, the pills
 * of a row keep the left-to-right order of their objects so their leaders fan out without
 * crossing, and a thin leader runs from each pill to the object itself.
 *
 * A row holds what its width holds. When the nearer rail's row is full a pill takes the other
 * rail's, and when both are full it starts a second row inside the first (nine names on a 690 px
 * pane need it; eight do not). When all four rows are full the remaining pills are left out, as
 * before, and stay reachable by name in the finder. A pill the current step points at is placed
 * first, so it is the last to be left out.
 */
export function placeSceneLabelsOnRails(
  boxes: readonly SceneLabelBox[],
  {
    priorityIds = [],
    obstacles = [],
    bounds,
    gap = SCENE_LABEL_RAIL_GAP_PX,
    minLeader = 10,
  }: SceneLabelRailOptions,
): Map<string, SceneLabelPlacement> {
  const priority = new Set(priorityIds)
  const placements = new Map<string, SceneLabelPlacement>()
  const hidden = (box: SceneLabelBox): SceneLabelPlacement => ({
    side: 'above',
    leader: minLeader,
    offsetY: -(minLeader + box.height / 2),
    offsetX: 0,
    visible: false,
  })

  // Row 0 is against the canvas edge; row 1 is the second row, inside it.
  const rows = { above: [[], []] as RailItem[][], below: [[], []] as RailItem[][] }
  const middle = bounds.height / 2
  const eligible: SceneLabelBox[] = []
  for (const box of boxes) {
    const onCanvas = box.x >= 0 && box.x <= bounds.width && box.y >= 0 && box.y <= bounds.height
    if (!onCanvas || box.width > bounds.width - 2 * gap) placements.set(box.id, hidden(box))
    else eligible.push(box)
  }
  // The pill a step points at first, then the pills that most clearly belong to one rail.
  eligible.sort(
    (a, b) =>
      Number(priority.has(b.id)) - Number(priority.has(a.id)) ||
      Math.abs(b.y - middle) - Math.abs(a.y - middle) ||
      a.id.localeCompare(b.id),
  )
  for (const box of eligible) {
    const near = box.y <= middle ? 'above' : 'below'
    const far = near === 'above' ? 'below' : 'above'
    const row = [rows[near][0], rows[far][0], rows[near][1], rows[far][1]].find(
      (candidate) => railWidth(candidate, gap) + box.width + gap <= bounds.width,
    )
    if (row) row.push({ box, left: 0 })
    else placements.set(box.id, hidden(box))
  }

  for (const side of ['above', 'below'] as const) {
    let edge = gap
    rows[side].forEach((row, rowIndex) => {
      if (row.length === 0) return
      spreadAlongRail(row, bounds.width, gap)
      const rowHeight = Math.max(...row.map((item) => item.box.height))
      for (const item of row) {
        const { box } = item
        const pillTop = side === 'above' ? edge : bounds.height - edge - box.height
        const rect: SceneRect = {
          left: item.left,
          right: item.left + box.width,
          top: pillTop,
          bottom: pillTop + box.height,
        }
        const leader = side === 'above' ? box.y - rect.bottom : rect.top - box.y
        // Its object has to be clear of the pill by a leader, and no overlay may sit over it.
        if (leader < minLeader || obstacles.some((obstacle) => intersects(rect, obstacle, gap))) {
          placements.set(box.id, hidden(box))
          continue
        }
        placements.set(box.id, {
          side,
          leader,
          offsetY: side === 'above' ? -(leader + box.height / 2) : leader + box.height / 2,
          offsetX: item.left + box.width / 2 - box.x,
          visible: true,
          row: rowIndex === 0 ? 0 : 1,
        })
      }
      edge += rowHeight + gap
    })
  }
  return placements
}
