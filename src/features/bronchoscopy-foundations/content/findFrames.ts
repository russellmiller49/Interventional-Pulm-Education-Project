import { FIND_FRAME_SIZE, FIND_FRAMES } from '../data/generated/findFrames.generated'

/**
 * The frames the click-on-image questions use: moments of the annotated normal survey on which the
 * survey's own annotation set outlines two or more openings. The files and outlines are cut by
 * `scripts/bronchoscopy-foundations/build-find-frames.mjs` and are not edited by hand.
 */
export type FindFrameId = keyof typeof FIND_FRAMES | keyof typeof PICTURE_FRAMES

export interface FindMarker {
  readonly id: string
  readonly name: string
  /** A shorter word to draw on the picture once the answer is shown, when the name is too long. */
  readonly short?: string
  /** The outline, as flat x, y pairs in the frame's coordinates. */
  readonly points: readonly number[]
}

export interface FindFrame {
  readonly src: string
  readonly sourceFrame: number
  readonly markers: readonly FindMarker[]
  /** The picture's own size, when it is not a frame of the survey video. */
  readonly size?: { readonly width: number; readonly height: number }
}

/** A box, as an outline's flat x, y pairs. */
const box = (left: number, top: number, right: number, bottom: number): readonly number[] => [
  left,
  top,
  right,
  top,
  right,
  bottom,
  left,
  bottom,
]

/**
 * Pictures that are not frames of the survey video. Each ships already; its regions are boxes
 * drawn round the things it shows, in the picture's own coordinates.
 *
 * `accessory-states` is the render of the simulator's six accessory states: forceps, brush and
 * needle across, closed or sheathed above, open or exposed below.
 */
const PICTURE_FRAMES = {
  'accessory-states': {
    src: '/bronchoscopy-foundations/anatomy/review/accessories.png',
    sourceFrame: 0,
    size: { width: 1200, height: 700 },
    markers: [
      {
        id: 'forceps-closed',
        name: 'Forceps, cups closed',
        short: 'Closed',
        points: box(90, 70, 310, 280),
      },
      {
        id: 'brush-sheathed',
        name: 'Brush, in its sheath',
        short: 'Sheathed',
        points: box(490, 70, 710, 280),
      },
      {
        id: 'needle-sheathed',
        name: 'Needle, in its sheath',
        short: 'Sheathed',
        points: box(890, 70, 1110, 280),
      },
      {
        id: 'forceps-open',
        name: 'Forceps, cups open',
        short: 'Open',
        points: box(90, 390, 310, 630),
      },
      {
        id: 'brush-exposed',
        name: 'Brush, bristles exposed',
        short: 'Exposed',
        points: box(490, 390, 710, 630),
      },
      {
        id: 'needle-exposed',
        name: 'Needle, out of its sheath',
        short: 'Exposed',
        points: box(890, 390, 1110, 630),
      },
    ],
  },
} as const satisfies Record<string, FindFrame>

const ALL_FRAMES: Readonly<Record<string, FindFrame>> = { ...FIND_FRAMES, ...PICTURE_FRAMES }

export const FIND_FRAME_IDS = Object.keys(ALL_FRAMES) as readonly FindFrameId[]
export { FIND_FRAME_SIZE }

export function findFrame(id: FindFrameId): FindFrame {
  return ALL_FRAMES[id]
}

/** The coordinate space a frame's outlines are in: its own size, or the survey video's. */
export function findFrameSize(frame: FindFrame): {
  readonly width: number
  readonly height: number
} {
  return frame.size ?? FIND_FRAME_SIZE
}

export function isFindFrameId(value: string): value is FindFrameId {
  return Object.prototype.hasOwnProperty.call(ALL_FRAMES, value)
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
  word: 'Opening' | 'Structure' | 'Tool' = 'Opening',
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
