/** Pure geometry adapter: no React, Three or alternative projection convention. */
import {
  beamDirection,
  centeredForTeaching,
  clamp,
  DEFAULT_GEOMETRY,
  LESION_CENTER,
  LESION_RADIUS,
  magnificationAt,
  projectPoint,
  projectToDetector,
  toolTipForDepth,
  temporalMetrics,
  type ImagingGeometry,
  type Point3,
} from '../../lib/physics'
import type { ChainStop, SuiteInputs } from './types'
export { dtsArc, dtsPlaneQuad, smearWidth, missingWedge } from './dtsModel'
export { samplingPlanes } from './samplingModel'

export const add = (a: Point3, b: Point3): Point3 => a.map((n, i) => n + b[i]) as Point3
export const subtract = (a: Point3, b: Point3): Point3 => a.map((n, i) => n - b[i]) as Point3
export const scale = (a: Point3, factor: number): Point3 => a.map((n) => n * factor) as Point3
export const dot = (a: Point3, b: Point3) => a.reduce((sum, n, i) => sum + n * b[i], 0)

export interface SuiteFrame {
  readonly orbit: number
  readonly tilt: number
  readonly geometry: ImagingGeometry
  readonly iso: Point3
  readonly source: Point3
  readonly detectorCenter: Point3
  readonly normal: Point3
  readonly u: Point3
  readonly v: Point3
  readonly corners: readonly Point3[]
}

export function suiteFrame(
  orbit: number,
  tilt = 0,
  geometry = DEFAULT_GEOMETRY,
  iso: Point3 = [0, 0, 0],
): SuiteFrame {
  const normal = beamDirection(orbit, tilt)
  // Projecting each basis vector gives the rows of the shared detector transform.
  const basis: Point3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  const u = basis.map((p) => projectPoint(p, orbit, tilt)[0]) as Point3
  const v = basis.map((p) => projectPoint(p, orbit, tilt)[1]) as Point3
  const source = add(iso, scale(normal, -geometry.sod))
  const detectorCenter = add(iso, scale(normal, geometry.sid - geometry.sod))
  const frame = { orbit, tilt, geometry, iso, source, detectorCenter, normal, u, v }
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) =>
    add(
      detectorCenter,
      add(scale(u, (x * geometry.field) / 2), scale(v, (y * geometry.field) / 2)),
    ),
  )
  return { ...frame, corners }
}

export function detectorPoint(frame: SuiteFrame, [u, v]: readonly [number, number]): Point3 {
  return add(frame.detectorCenter, add(scale(frame.u, u), scale(frame.v, v)))
}
export function rayThrough(frame: SuiteFrame, point: Point3) {
  const uv = projectToDetector(subtract(point, frame.iso), frame.orbit, frame.tilt, frame.geometry)
  return { source: frame.source, point, hit: detectorPoint(frame, uv), uv }
}
/** Target-centred shutter rectangle, clamped to the full detector exactly like the SVG. */
export function collimator(frame: SuiteFrame, fieldPercent: number, target = LESION_CENTER) {
  const [u, v] = rayThrough(frame, target).uv
  const field = frame.geometry.field,
    side = (field * clamp(fieldPercent, 0, 100)) / 100
  const left = clamp(u - side / 2, -field / 2, field / 2 - side)
  const bottom = clamp(v - side / 2, -field / 2, field / 2 - side)
  return {
    left,
    bottom,
    side,
    corners: [
      [left, bottom],
      [left + side, bottom],
      [left + side, bottom + side],
      [left, bottom + side],
    ].map((uv) => detectorPoint(frame, uv as [number, number])),
  }
}
export function coneFrustum(frame: SuiteFrame, fieldPercent: number, target = LESION_CENTER) {
  const shutter = collimator(frame, fieldPercent, target)
  return { source: frame.source, ...shutter }
}
export function projectionMarkers(
  frame: SuiteFrame,
  depth: number,
  offset: Point3 = [0, 0, 0],
  toolFollows = true,
) {
  const target = add(LESION_CENTER, offset)
  const tip = add(toolTipForDepth(depth), toolFollows ? offset : [0, 0, 0])
  const start = add(tip, [-65, 0, 0])
  return {
    target,
    tip,
    start,
    targetRay: rayThrough(frame, target),
    tipRay: rayThrough(frame, tip),
    startRay: rayThrough(frame, start),
    radius:
      LESION_RADIUS *
      magnificationAt(dot(subtract(target, frame.iso), frame.normal), frame.geometry),
  }
}
export function penumbraMm(focalSpotMm: number, depth: number, geometry = DEFAULT_GEOMETRY) {
  return focalSpotMm * (magnificationAt(depth, geometry) - 1)
}
/** The room is schematic; relative placements are expressed through the shared beam dimensions. */
export function chainStopAnchors(frame: SuiteFrame): Record<ChainStop, Point3> {
  const { sod } = frame.geometry
  const field = DEFAULT_GEOMETRY.field
  return {
    source: frame.source,
    beam: add(frame.source, scale(frame.normal, sod * 0.45)),
    patient: frame.iso,
    detector: frame.detectorCenter,
    reconstruction: [field * 0.85, -sod * 0.2, -field * 0.85],
    display: [field * 1.1, sod * 0.15, -field * 0.55],
  }
}
export function anatomyOffset(inputs: SuiteInputs, registration = false): Point3 {
  if (registration) return [0, 0, -inputs.displacement]
  return [inputs.offsetX, inputs.offsetDepth, 0]
}

/** Field sliders select either a physical shutter or a display crop, per the lab oracle. */
export function fieldGeometry(frame: SuiteFrame, fieldPercent: number, crop: boolean) {
  const aperture = collimator(frame, crop ? 100 : fieldPercent)
  const image = collimator(frame, fieldPercent)
  const atDistance = (point: Point3, distance: number) =>
    add(frame.source, scale(subtract(point, frame.source), distance / frame.geometry.sid))
  const targetDistance = dot(subtract(LESION_CENTER, frame.source), frame.normal)
  const half = frame.geometry.field / 2
  const rectangles = [
    [-half, -half, image.left, half],
    [image.left + image.side, -half, half, half],
    [image.left, -half, image.left + image.side, image.bottom],
    [image.left, image.bottom + image.side, image.left + image.side, half],
  ]
  return {
    aperture,
    image,
    blades: aperture.corners.map((p) => atDistance(p, frame.geometry.sod * 0.1)),
    irradiated: aperture.corners.map((p) => atDistance(p, targetDistance)),
    masks: rectangles.map(([left, bottom, right, top]) =>
      [
        [left, bottom],
        [right, bottom],
        [right, top],
        [left, top],
      ].map((uv) => add(detectorPoint(frame, uv as [number, number]), scale(frame.normal, -1))),
    ),
  }
}

/** Clock seconds, with a held image from the most recently completed exposure. */
export function temporal(
  inputs: Pick<SuiteInputs, 'pulseRate' | 'pulseWidthMs' | 'speedMmS' | 'phase'>,
) {
  const { pulseRate, pulseWidthMs, speedMmS } = inputs
  const phase = Math.max(0, inputs.phase)
  const widthSeconds = pulseWidthMs / 1000
  const pulseIndex = Math.floor(phase * pulseRate + 1e-9)
  const sampleIndex = Math.max(-1, Math.floor((phase - widthSeconds) * pulseRate + 1e-9))
  const sampledTipAt = (seconds: number): Point3 =>
    add(LESION_CENTER, [-32 + speedMmS * seconds, 0, 0])
  const sampleTime = Math.max(0, sampleIndex) / pulseRate
  return {
    ...temporalMetrics(pulseRate, pulseWidthMs, 20, speedMmS),
    pulseIsOn: phase - pulseIndex / pulseRate < widthSeconds,
    sampleIndex,
    sampleTime,
    sampledTipAt,
    currentTip: sampledTipAt(phase),
    sampledTip: sampledTipAt(sampleTime + widthSeconds),
    blurSegment: [sampledTipAt(sampleTime), sampledTipAt(sampleTime + widthSeconds)] as [
      Point3,
      Point3,
    ],
  }
}

/** Authored gantry illustrations, not manufacturer dimensions or supported trajectories. */
export const GANTRY_VARIANTS = {
  generic: { panelMm: DEFAULT_GEOMETRY.field, mount: 'pedestal' },
  fixed: { panelMm: DEFAULT_GEOMETRY.field, mount: 'fixed' },
  mobile: { panelMm: 300, mount: 'cart' },
} as const
export function cbctOrbitSamples(span: number, count: number) {
  const n = Math.max(2, Math.round(count))
  return Array.from({ length: n }, (_, i) => -span / 2 + (span * i) / (n - 1))
}
export function fovCylinder(variant: SuiteInputs['variant'], geometry = DEFAULT_GEOMETRY) {
  const radius = ((GANTRY_VARIANTS[variant].panelMm / 2) * geometry.sod) / geometry.sid
  return { radius, height: radius * 2 }
}
export function cbctSetup(inputs: SuiteInputs) {
  return {
    geometry: { ...inputs.geometry, field: GANTRY_VARIANTS[inputs.variant].panelMm },
    offset: add(scale(LESION_CENTER, -1), [inputs.offsetX, inputs.offsetDepth, 0]),
    target: [inputs.offsetX, inputs.offsetDepth, 0] as Point3,
    centered: centeredForTeaching(inputs.offsetX, inputs.offsetDepth),
    fov: fovCylinder(inputs.variant, inputs.geometry),
  }
}
/** Swept housing bounds sampled from the same frame used by the gantry; no collision query. */
export function sweptEnvelope(
  variant: SuiteInputs['variant'],
  span: number,
  geometry = DEFAULT_GEOMETRY,
) {
  const panel = GANTRY_VARIANTS[variant].panelMm
  const frames = cbctOrbitSamples(span, 65).map((angle) =>
    suiteFrame(angle, 0, { ...geometry, field: panel }),
  )
  return {
    source: frames.map((frame) => add(frame.source, scale(frame.normal, -panel * 0.11))),
    detector: frames.map((frame) => add(frame.detectorCenter, scale(frame.normal, panel * 0.05))),
    halfWidth: panel * 0.52,
  }
}
