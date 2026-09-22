/** Parallel teaching projections are distinct from the cone-geometry orientation arc. */
import { DTS } from '../../lib/tomosynthesis'
import { DEFAULT_GEOMETRY, dtsShift, LESION_CENTER, type Point3 } from '../../lib/physics'
import { add, suiteFrame } from './suiteModel'
export function dtsArc(sweep: number, geometry = DEFAULT_GEOMETRY) {
  return Array.from({ length: DTS.viewsPerSweep }, (_, i) => {
    const angle = -sweep / 2 + (sweep * i) / (DTS.viewsPerSweep - 1)
    return { angle, source: suiteFrame(angle, 0, geometry).source }
  })
}
export function dtsPlaneQuad(depth: number): Point3[] {
  return [
    [-70, -70],
    [70, -70],
    [70, 70],
    [-70, 70],
  ].map(([x, z]) => add(LESION_CENTER, [x - 20, depth, z]))
}
export function smearWidth(objectDepth: number, planeDepth: number, sweep: number) {
  return Math.abs(
    dtsShift(objectDepth, planeDepth, sweep / 2) - dtsShift(objectDepth, planeDepth, -sweep / 2),
  )
}
export function missingWedge(sweep: number) {
  return [
    [sweep / 2, 180 - sweep / 2],
    [180 + sweep / 2, 360 - sweep / 2],
  ] as const
}

/**
 * Where the teaching model placed its two authored objects, in the reconstructed plane's own
 * pixels. Report 4.2 (fellow walkthrough, PDF p.33/p.38): the plane carried no mark for either, and
 * the tool — a faint horizontal line — could not be found.
 *
 * Nothing here is detected in the image. The target's centre and radius come from the projection
 * manifest (`DTS.targetCenterMm`, `authoredNodule.radiusMm`, `toolPlaneRelativeMm`); the tool's
 * extent is the literal the generator drew it with (`scripts/peripheral-imaging/
 * build-dts-projections.py`: a 1.8 mm cylinder from 60 mm short of the target centre up to it, 18 mm
 * from the target's plane). `dts-overlay.test.ts` pins both sources, so the overlay cannot drift
 * from the pixels it annotates.
 */
export const DTS_TOOL_MM = { start: -60, end: 0, radius: 1.8 } as const

/** The reconstructed plane: `reconstructTeachingPlane` spans 140 mm, centred 20 mm short of the target. */
export const DTS_PLANE = { spanMm: 140, centreOffsetMm: -20, sizePx: 256 } as const

export interface DtsOverlayObject {
  readonly id: 'tool' | 'target'
  readonly label: string
  /** The object's own depth relative to the target plane, in mm. */
  readonly depthMm: number
  /** Signed distance from the selected plane to the object, in mm. */
  readonly fromPlaneMm: number
  /**
   * Whether the selected plane passes through the object. Only then is it drawn as lying in the
   * plane; otherwise the mark says where the model put it and how far from this plane that is, and
   * claims nothing about what the image shows there.
   */
  readonly inPlane: boolean
  /** Bounding box in plane pixels (0–256), for the mark. */
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
}

export function dtsOverlayObjects(planeDepth: number): readonly DtsOverlayObject[] {
  const pxPerMm = DTS_PLANE.sizePx / DTS_PLANE.spanMm
  const col = (mmFromTarget: number) =>
    DTS_PLANE.sizePx / 2 + (mmFromTarget - DTS_PLANE.centreOffsetMm) * pxPerMm
  const row = DTS_PLANE.sizePx / 2
  const radius = DTS.authoredNodule.radiusMm
  const toolFrom = DTS.toolPlaneRelativeMm - planeDepth
  const targetFrom = 0 - planeDepth
  const toolHalf = Math.max(DTS_TOOL_MM.radius * pxPerMm, 2)
  return [
    {
      id: 'tool',
      label: 'Tool (model position)',
      depthMm: DTS.toolPlaneRelativeMm,
      fromPlaneMm: toolFrom,
      inPlane: Math.abs(toolFrom) <= DTS_TOOL_MM.radius,
      box: {
        x: col(DTS_TOOL_MM.start),
        y: row - toolHalf,
        w: (DTS_TOOL_MM.end - DTS_TOOL_MM.start) * pxPerMm,
        h: toolHalf * 2,
      },
    },
    {
      id: 'target',
      label: 'Target (model position)',
      depthMm: 0,
      fromPlaneMm: targetFrom,
      inPlane: Math.abs(targetFrom) < radius,
      box: {
        x: col(-radius),
        y: row - radius * pxPerMm,
        w: radius * 2 * pxPerMm,
        h: radius * 2 * pxPerMm,
      },
    },
  ]
}
