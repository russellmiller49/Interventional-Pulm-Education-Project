/**
 * A magnified look at one registered annotation, cut from the same photograph (fellow walkthrough
 * A18).
 *
 * Views 2, 3 and 6 of the instrument set outline a part a few dozen pixels across on a photograph
 * of the whole bronchoscope, so at the size the card can give the whole photograph the outline is a
 * dozen screen pixels. The detail is a window onto the source file around that outline: the same
 * pixels and the same polygon, in the photograph's own coordinates, so the outline stays on the
 * part at every size. Nothing is re-drawn, re-sampled into a new file or sharpened.
 */

export interface MediaBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface DetailRegion {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** An outline smaller than this share of the photograph on both axes gets a detail view. */
export const DETAIL_SHARE = 0.15
/** The detail shows the outline with this much of its surroundings, as a multiple of its size. */
export const DETAIL_CONTEXT = 2.4
/** Never less than this share of the photograph's shorter side, so a tiny outline keeps context. */
export const DETAIL_MIN_SHARE = 0.12

export function pointBounds(points: readonly number[]): MediaBounds | null {
  if (points.length < 6 || points.length % 2 !== 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < points.length; index += 2) {
    const x = points[index]
    const y = points[index + 1]
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

/** Whether the outline is small enough on the photograph that the card should show a detail. */
export function needsDetail(bounds: MediaBounds, width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false
  const share = Math.max((bounds.maxX - bounds.minX) / width, (bounds.maxY - bounds.minY) / height)
  return share < DETAIL_SHARE
}

/**
 * A square window around the outline, inside the photograph. The outline sits in its middle unless
 * the photograph's edge is closer, in which case the window stops at the edge rather than invent
 * pixels beyond it.
 */
export function detailRegion(bounds: MediaBounds, width: number, height: number): DetailRegion {
  const shorter = Math.min(width, height)
  const size = Math.min(
    shorter,
    Math.max(
      DETAIL_MIN_SHARE * shorter,
      DETAIL_CONTEXT * Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY),
    ),
  )
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const x = Math.min(width - size, Math.max(0, centerX - size / 2))
  const y = Math.min(height - size, Math.max(0, centerY - size / 2))
  return { x, y, width: size, height: size }
}
