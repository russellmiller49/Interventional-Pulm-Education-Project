/**
 * Screen-space placement for the bedside scene's label pills.
 *
 * Every pill rests just above its anchor on a short vertical leader. At a readable type size the
 * default camera puts some anchors closer together than the pills are wide (the femoral return, both
 * clamps and the module crowd the centre of the frame), and the HUD and the labels toggle sit over
 * the canvas corners. So a pill that would land on another pill or on one of those overlays moves
 * straight up — or, when that is shorter or the only way to stay inside the canvas, straight down
 * below its anchor — on a longer leader, until it clears. Nothing moves sideways and no anchor
 * moves: the leader still ends on the object the pill names.
 *
 * Pills are placed in priority order — an emphasised pill first, then from the lowest anchor up — so
 * the pill a teaching step points at, and the pills nearest the floor, keep their resting place.
 */

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

/**
 * Where each pill goes. A pill with nothing in the way rests above its anchor on the resting
 * leader; otherwise it takes the shorter clear shift, up or down, that keeps it inside the canvas.
 * When neither direction clears within the cap, it keeps the shorter of the two capped shifts.
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
  const placements = new Map<string, SceneLabelPlacement>()

  for (const box of order) {
    const left = box.x - box.width / 2
    const right = box.x + box.width / 2
    const rect = (side: 'above' | 'below', shift: number): SceneRect => {
      const top =
        side === 'above'
          ? box.y - restingLeader - shift - box.height
          : box.y + restingLeader + shift
      return { left, right, top, bottom: top + box.height }
    }
    const clearShift = (side: 'above' | 'below') => {
      let shift = 0
      // Each pass either clears everything placed or moves past one of them.
      for (let pass = 0; pass <= placed.length; pass += 1) {
        const candidate = rect(side, shift)
        const hit = placed.find((other) => intersects(candidate, other, gap))
        if (!hit) break
        // Bring the near edge to just past the thing in the way.
        shift =
          side === 'above'
            ? box.y - restingLeader - (hit.top - gap)
            : hit.bottom + gap - (box.y + restingLeader)
      }
      const final = rect(side, shift)
      const inside =
        shift <= maxShift && (!bounds || (final.top >= 0 && final.bottom <= bounds.height))
      return { side, shift: Math.max(0, Math.round(shift)), inside }
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
    placed.push(rect(choice.side, shift))
    placements.set(box.id, { side: choice.side, leader, offsetY })
  }
  return placements
}
