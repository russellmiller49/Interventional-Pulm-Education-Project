import { FIND_FRAME_SIZE, FIND_FRAMES } from '../data/generated/findFrames.generated'

/**
 * The frames the click-on-image questions use: moments of the annotated normal survey on which the
 * survey's own annotation set outlines two or more openings. The files and outlines are cut by
 * `scripts/bronchoscopy-foundations/build-find-frames.mjs` and are not edited by hand.
 */
export type FindFrameId = keyof typeof FIND_FRAMES

export interface FindMarker {
  readonly id: string
  readonly name: string
  /** The outline, as flat x, y pairs in the frame's coordinates. */
  readonly points: readonly number[]
}

export interface FindFrame {
  readonly src: string
  readonly sourceFrame: number
  readonly markers: readonly FindMarker[]
}

export const FIND_FRAME_IDS = Object.keys(FIND_FRAMES) as readonly FindFrameId[]
export { FIND_FRAME_SIZE }

export function findFrame(id: FindFrameId): FindFrame {
  return FIND_FRAMES[id]
}

export function isFindFrameId(value: string): value is FindFrameId {
  return Object.prototype.hasOwnProperty.call(FIND_FRAMES, value)
}

/** The middle of an outline: the mean of its vertices. */
export function markerCentre(marker: FindMarker): { readonly x: number; readonly y: number } {
  const count = marker.points.length / 2
  let x = 0
  let y = 0
  for (let index = 0; index < marker.points.length; index += 2) {
    x += marker.points[index]
    y += marker.points[index + 1]
  }
  return { x: x / count, y: y / count }
}

function markerDegrees(frame: FindFrame, marker: FindMarker, rotation: number): number {
  const centres = frame.markers.map(markerCentre)
  const middle = {
    x: centres.reduce((sum, centre) => sum + centre.x, 0) / centres.length,
    y: centres.reduce((sum, centre) => sum + centre.y, 0) / centres.length,
  }
  const centre = markerCentre(marker)
  return (
    ((Math.atan2(centre.x - middle.x, -(centre.y - middle.y)) * 180) / Math.PI + rotation + 360) %
    360
  )
}

/**
 * Where an outline sits among the frame's outlines, as an hour on a clock face centred on all of
 * them, after the frame has been turned by `rotation` degrees clockwise.
 */
export function markerClock(frame: FindFrame, marker: FindMarker, rotation = 0): number {
  const hour = Math.round(markerDegrees(frame, marker, rotation) / 30) % 12
  return hour === 0 ? 12 : hour
}

/**
 * A name for each outline that says where it is and not what it is: "Opening B, at 4 o'clock",
 * or "Structure B" on a frame whose outlines are not openings.
 * Letters run clockwise from the top of the frame as shown, so the name is the same for someone
 * using a keyboard or a screen reader as the outline is for someone looking at it.
 */
export function markerNames(
  frame: FindFrame,
  rotation = 0,
  word: 'Opening' | 'Structure' = 'Opening',
): ReadonlyMap<string, string> {
  const ordered = [...frame.markers].sort(
    (a, b) => markerDegrees(frame, a, rotation) - markerDegrees(frame, b, rotation),
  )
  return new Map(
    ordered.map((marker, index) => [
      marker.id,
      `${word} ${String.fromCharCode(65 + index)}, at ${markerClock(frame, marker, rotation)} o’clock`,
    ]),
  )
}

export function findFrameErrors(
  where: string,
  row: { readonly frameId: string; readonly targetId: string },
): readonly string[] {
  if (!isFindFrameId(row.frameId)) return [`${where} names an unknown frame ${row.frameId}.`]
  const frame = findFrame(row.frameId)
  if (!frame.markers.some((marker) => marker.id === row.targetId))
    return [`${where} asks for ${row.targetId}, which frame ${row.frameId} does not outline.`]
  return []
}
