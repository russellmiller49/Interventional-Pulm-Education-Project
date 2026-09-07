import type { McsMapPathwayId, McsMapSegmentId } from '../../content/supportSpine'

/**
 * The circulation map's geometry: one loop, drawn once.
 *
 * Blood runs clockwise — up the left side through the right heart, across the top through the
 * lung, down the right side through the left heart and the aorta, and back along the bottom
 * through the body. Chambers are rounded boxes on the loop; vessels are stroked centrelines. The
 * drawing and every halo read the same path strings, so a second copy of a path cannot become a
 * second opinion about where a segment is.
 *
 * The view box is 1000 × 600. Every coordinate here is in that space.
 */

export const CIRCULATION_MAP_VIEW_BOX = { width: 1000, height: 600 } as const

export type McsMapSegmentShape =
  | { readonly kind: 'vessel'; readonly d: string }
  | {
      readonly kind: 'chamber'
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
      readonly radius: number
    }
  | {
      readonly kind: 'organ'
      readonly cx: number
      readonly cy: number
      readonly rx: number
      readonly ry: number
    }

export interface McsMapSegment {
  readonly id: McsMapSegmentId
  readonly label: string
  readonly shape: McsMapSegmentShape
  /** Where the segment's label sits. */
  readonly labelAt: {
    readonly x: number
    readonly y: number
    readonly anchor: 'start' | 'middle' | 'end'
  }
  /** Where an answer pin for this segment sits. */
  readonly pinAt: { readonly x: number; readonly y: number }
}

const LEFT_X = 150
const RIGHT_X = 850
const TOP_Y = 90
const BOTTOM_Y = 520

export const CIRCULATION_MAP_SEGMENTS: readonly McsMapSegment[] = [
  {
    id: 'systemic-bed',
    label: 'The body',
    shape: { kind: 'organ', cx: 500, cy: BOTTOM_Y, rx: 120, ry: 34 },
    labelAt: { x: 500, y: BOTTOM_Y + 6, anchor: 'middle' },
    pinAt: { x: 500, y: BOTTOM_Y - 52 },
  },
  {
    id: 'venous-return',
    label: 'Venous return',
    shape: { kind: 'vessel', d: `M 380 ${BOTTOM_Y} L ${LEFT_X} ${BOTTOM_Y} L ${LEFT_X} 478` },
    labelAt: { x: 265, y: BOTTOM_Y - 24, anchor: 'middle' },
    pinAt: { x: 265, y: BOTTOM_Y + 40 },
  },
  {
    id: 'right-atrium',
    label: 'Right atrium',
    shape: { kind: 'chamber', x: LEFT_X - 40, y: 410, width: 80, height: 68, radius: 18 },
    labelAt: { x: LEFT_X + 56, y: 448, anchor: 'start' },
    pinAt: { x: LEFT_X - 68, y: 444 },
  },
  {
    id: 'right-ventricle',
    label: 'Right ventricle',
    shape: { kind: 'chamber', x: LEFT_X - 48, y: 300, width: 96, height: 100, radius: 22 },
    labelAt: { x: LEFT_X + 64, y: 354, anchor: 'start' },
    pinAt: { x: LEFT_X - 76, y: 350 },
  },
  {
    id: 'pulmonary-artery',
    label: 'Pulmonary artery',
    shape: { kind: 'vessel', d: `M ${LEFT_X} 300 L ${LEFT_X} ${TOP_Y} L 350 ${TOP_Y}` },
    labelAt: { x: LEFT_X + 24, y: 200, anchor: 'start' },
    pinAt: { x: LEFT_X - 44, y: 200 },
  },
  {
    id: 'lungs',
    label: 'The lungs',
    shape: { kind: 'organ', cx: 500, cy: TOP_Y, rx: 150, ry: 44 },
    labelAt: { x: 500, y: TOP_Y + 6, anchor: 'middle' },
    pinAt: { x: 500, y: TOP_Y + 66 },
  },
  {
    id: 'left-atrium',
    label: 'Left atrium',
    shape: { kind: 'chamber', x: RIGHT_X - 40, y: 138, width: 80, height: 62, radius: 18 },
    labelAt: { x: RIGHT_X - 56, y: 172, anchor: 'end' },
    pinAt: { x: RIGHT_X + 68, y: 168 },
  },
  {
    id: 'left-ventricle',
    label: 'Left ventricle',
    shape: { kind: 'chamber', x: RIGHT_X - 52, y: 210, width: 104, height: 118, radius: 24 },
    labelAt: { x: RIGHT_X - 68, y: 272, anchor: 'end' },
    pinAt: { x: RIGHT_X + 80, y: 268 },
  },
  {
    id: 'aortic-valve',
    label: 'Aortic valve',
    shape: { kind: 'vessel', d: `M ${RIGHT_X} 328 L ${RIGHT_X} 352` },
    labelAt: { x: RIGHT_X - 30, y: 345, anchor: 'end' },
    pinAt: { x: RIGHT_X + 48, y: 340 },
  },
  {
    id: 'ascending-aorta',
    label: 'Ascending aorta',
    shape: { kind: 'vessel', d: `M ${RIGHT_X} 352 L ${RIGHT_X} 418` },
    labelAt: { x: RIGHT_X - 30, y: 392, anchor: 'end' },
    pinAt: { x: RIGHT_X + 48, y: 386 },
  },
  {
    id: 'descending-aorta',
    label: 'Descending aorta',
    shape: { kind: 'vessel', d: `M ${RIGHT_X} 418 L ${RIGHT_X} ${BOTTOM_Y} L 620 ${BOTTOM_Y}` },
    labelAt: { x: RIGHT_X - 30, y: 470, anchor: 'end' },
    pinAt: { x: RIGHT_X + 48, y: 466 },
  },
]

export const circulationMapSegmentById: ReadonlyMap<McsMapSegmentId, McsMapSegment> = new Map(
  CIRCULATION_MAP_SEGMENTS.map((segment) => [segment.id, segment]),
)

export function circulationMapSegment(id: McsMapSegmentId): McsMapSegment {
  const segment = circulationMapSegmentById.get(id)
  if (!segment) throw new Error(`No map geometry for segment ${id}`)
  return segment
}

/** The lungs also sit between the pulmonary artery's end and the left atrium's start. */
export const LEFT_ATRIUM_INFLOW_D = `M 650 ${TOP_Y} L ${RIGHT_X} ${TOP_Y} L ${RIGHT_X} 138`

export interface McsMapPathwayShape {
  readonly id: McsMapPathwayId
  readonly label: string
  /** The device's own path, drawn over the loop. */
  readonly d: string
  /** Where the device's active component sits, for the marker and the label. */
  readonly componentAt: { readonly x: number; readonly y: number }
  readonly inletAt?: { readonly x: number; readonly y: number }
  readonly outletAt?: { readonly x: number; readonly y: number }
  readonly labelAt: {
    readonly x: number
    readonly y: number
    readonly anchor: 'start' | 'middle' | 'end'
  }
}

export const CIRCULATION_MAP_PATHWAYS: readonly McsMapPathwayShape[] = [
  {
    id: 'iabp-balloon',
    label: 'Balloon in the descending aorta',
    d: `M ${RIGHT_X} 430 L ${RIGHT_X} 500`,
    componentAt: { x: RIGHT_X, y: 465 },
    labelAt: { x: RIGHT_X + 30, y: 462, anchor: 'start' },
  },
  {
    id: 'left-pump',
    label: 'Transvalvular pump: inlet in the ventricle, outlet in the aorta',
    d: `M ${RIGHT_X} 290 L ${RIGHT_X} 400`,
    componentAt: { x: RIGHT_X, y: 340 },
    inletAt: { x: RIGHT_X, y: 292 },
    outletAt: { x: RIGHT_X, y: 398 },
    labelAt: { x: RIGHT_X + 30, y: 300, anchor: 'start' },
  },
  {
    id: 'right-pump',
    label: 'Right-sided pump: inlet in the vena cava, outlet in the pulmonary artery',
    d: `M ${LEFT_X} 496 L 96 496 L 96 150 L ${LEFT_X} 150`,
    componentAt: { x: 96, y: 330 },
    inletAt: { x: LEFT_X - 4, y: 496 },
    outletAt: { x: LEFT_X - 4, y: 150 },
    labelAt: { x: 82, y: 320, anchor: 'end' },
  },
  {
    id: 'durable-pump',
    label: 'Durable pump: inflow at the apex, outflow graft to the ascending aorta',
    d: `M ${RIGHT_X + 44} 316 L 946 316 L 946 392 L ${RIGHT_X + 2} 392`,
    componentAt: { x: 946, y: 354 },
    inletAt: { x: RIGHT_X + 46, y: 316 },
    outletAt: { x: RIGHT_X + 4, y: 392 },
    labelAt: { x: 962, y: 300, anchor: 'end' },
  },
]

export const circulationMapPathwayById: ReadonlyMap<McsMapPathwayId, McsMapPathwayShape> = new Map(
  CIRCULATION_MAP_PATHWAYS.map((pathway) => [pathway.id, pathway]),
)

/** The blood path in order, for a "you are here" caption and for numbering pins along the loop. */
export const CIRCULATION_MAP_PATH_ORDER: readonly McsMapSegmentId[] = [
  'venous-return',
  'right-atrium',
  'right-ventricle',
  'pulmonary-artery',
  'lungs',
  'left-atrium',
  'left-ventricle',
  'aortic-valve',
  'ascending-aorta',
  'descending-aorta',
  'systemic-bed',
]
