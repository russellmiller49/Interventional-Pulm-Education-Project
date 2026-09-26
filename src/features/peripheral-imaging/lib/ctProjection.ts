/**
 * CT-derived projections for static teaching figures, computed on the CPU.
 *
 * The live suite draws its projection with FluoroView's WebGL volume renderer. A static figure needs
 * something that renderer does not give it: the image's own numbers, so that a simulated effect can
 * be applied in a physically shaped way (quantum noise in detected counts, a veil in fluence), and a
 * render that works without a WebGL context or an animation frame. This file is that twin.
 *
 * It keeps both halves of the suite's projection honest to the suite:
 * - Geometry: the rays run from `suiteFrame`'s source to `detectorPoint`s on its detector, exactly
 *   the points `rayThrough`/`projectToDetector` use, so a figure cannot disagree with the lab about
 *   where anything projects.
 * - Appearance: `huToMu` and the display curve are FluoroView's (`fluoro-viewer/src/volume-drr.ts`:
 *   `huToMu` at its default 80 kVp, `uMuScale` 7.5, `smoothstep(0.035, 0.92, lineIntegral)`), with
 *   the defaults the suite renders at (exposure gain 1, contrast boost 1, noise off). Denser is
 *   brighter, as on the suite's monitor.
 *
 * Nothing here is a detector, exposure, scatter or dose model. The CT is the course's quantized
 * teaching volume with its authored nodule.
 */
import { ANATOMY } from './anatomy'
import { DEFAULT_GEOMETRY, LESION_CENTER, projectToDetector, type Point3 } from './physics'
import { detectorPoint, suiteFrame } from '../components/suite/suiteModel'

/** HU at a world point, in millimetres (x patient left, y anterior, z superior). */
export type CtSampler = (x: number, y: number, z: number) => number

/**
 * The same trilinear sample as `sampleAnatomy`, without allocating per call: a projection takes
 * millions of samples. Outside the volume it reads −1000 HU, as `sampleAnatomy` does.
 */
export function ctSampler(volume: Uint8Array): CtSampler {
  const [sx, sy, sz] = ANATOMY.sizeXyz
  const [ox, oy, oz] = ANATOMY.originMm
  const [dx, dy, dz] = ANATOMY.spacingMm
  const [huLow, huHigh] = ANATOMY.huRange
  const huScale = (huHigh - huLow) / 255
  const row = sx
  const plane = sx * sy
  return (x, y, z) => {
    const px = (x - ox) / dx
    const py = (y - oy) / dy
    const pz = (z - oz) / dz
    if (px < 0 || py < 0 || pz < 0 || px >= sx - 1 || py >= sy - 1 || pz >= sz - 1) return -1000
    const ix = Math.floor(px)
    const iy = Math.floor(py)
    const iz = Math.floor(pz)
    const fx = px - ix
    const fy = py - iy
    const fz = pz - iz
    const base = iz * plane + iy * row + ix
    const low =
      (volume[base] * (1 - fx) + volume[base + 1] * fx) * (1 - fy) +
      (volume[base + row] * (1 - fx) + volume[base + row + 1] * fx) * fy
    const high =
      (volume[base + plane] * (1 - fx) + volume[base + plane + 1] * fx) * (1 - fy) +
      (volume[base + plane + row] * (1 - fx) + volume[base + plane + row + 1] * fx) * fy
    return huLow + (low * (1 - fz) + high * fz) * huScale
  }
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** FluoroView's `huToMu` at its default 80 kVp (the kVp factor is then exactly 1). Per millimetre. */
export function huToMu(hu: number): number {
  const density = Math.max(0, (hu + 1000) / 1000)
  return (
    0.00013 * density + 0.00009 * smoothstep(-850, 80, hu) + 0.00038 * smoothstep(160, 1250, hu)
  )
}

/** FluoroView's `uMuScale`: the line integral is Σ huToMu · ds · 7.5. */
export const PROJECTION_MU_SCALE = 7.5

/** FluoroView's display curve at the suite's default settings: denser reads brighter, 0–1. */
export function projectionDisplay(lineIntegral: number): number {
  return smoothstep(0.035, 0.92, lineIntegral)
}

export interface ProjectionRequest {
  /** The model's signed C-arm obliquity, degrees. */
  readonly orbit: number
  /** The model's signed beam tilt, degrees. */
  readonly tilt: number
  /** Square image edge, in pixels. */
  readonly sizePx: number
  /** Square region of the detector the image covers, in detector millimetres. */
  readonly fieldMm: number
  /** The point the image is centred on; its projection is the image centre. */
  readonly centre?: Point3
  /** Ray-march step in millimetres. */
  readonly stepMm?: number
}

export interface CtProjection {
  readonly sizePx: number
  readonly fieldMm: number
  /** Detector coordinates of the image centre (the centre point's projection). */
  readonly centreUv: readonly [number, number]
  /** Row-major line integrals, FluoroView units (Σ μ · ds · 7.5), row 0 at the top. */
  readonly lineIntegral: Float32Array
}

/** Detector millimetres of the pixel centre at (col, row), with +u right and +v up. */
export function projectionPixelUv(
  image: Pick<CtProjection, 'sizePx' | 'fieldMm' | 'centreUv'>,
  col: number,
  row: number,
): [number, number] {
  const pitch = image.fieldMm / image.sizePx
  return [
    image.centreUv[0] + (col + 0.5 - image.sizePx / 2) * pitch,
    image.centreUv[1] - (row + 0.5 - image.sizePx / 2) * pitch,
  ]
}

/** Where a world point lands in the image, in fractional pixel coordinates. */
export function projectionPixelOf(
  image: Pick<CtProjection, 'sizePx' | 'fieldMm' | 'centreUv'>,
  point: Point3,
  orbit: number,
  tilt: number,
): [number, number] {
  const [u, v] = projectToDetector(point, orbit, tilt, DEFAULT_GEOMETRY)
  const pitch = image.fieldMm / image.sizePx
  return [
    (u - image.centreUv[0]) / pitch + image.sizePx / 2,
    image.sizePx / 2 - (v - image.centreUv[1]) / pitch,
  ]
}

/** Integrate the CT along the suite's cone rays for one detector region. */
export function projectCt(sample: CtSampler, request: ProjectionRequest): CtProjection {
  const { orbit, tilt, sizePx, fieldMm } = request
  const centre = request.centre ?? LESION_CENTER
  const step = request.stepMm ?? 1.5
  const frame = suiteFrame(orbit, tilt, DEFAULT_GEOMETRY)
  const centreUv = projectToDetector(centre, orbit, tilt, DEFAULT_GEOMETRY)
  const image = { sizePx, fieldMm, centreUv }
  const lineIntegral = new Float32Array(sizePx * sizePx)
  const low = ANATOMY.originMm
  const high = ANATOMY.originMm.map(
    (origin, axis) => origin + ANATOMY.spacingMm[axis] * (ANATOMY.sizeXyz[axis] - 1),
  )
  const [sx, sy, sz] = frame.source
  for (let row = 0; row < sizePx; row++) {
    for (let col = 0; col < sizePx; col++) {
      const hit = detectorPoint(frame, projectionPixelUv(image, col, row))
      const ex = hit[0] - sx
      const ey = hit[1] - sy
      const ez = hit[2] - sz
      const length = Math.hypot(ex, ey, ez)
      const d = [ex / length, ey / length, ez / length]
      const s = [sx, sy, sz]
      let entry = 0
      let exit = length
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(d[axis]) < 1e-12) {
          if (s[axis] < low[axis] || s[axis] > high[axis]) exit = -1
          continue
        }
        const a = (low[axis] - s[axis]) / d[axis]
        const b = (high[axis] - s[axis]) / d[axis]
        entry = Math.max(entry, Math.min(a, b))
        exit = Math.min(exit, Math.max(a, b))
      }
      let sum = 0
      for (let at = entry; at < exit; at += step) {
        const end = Math.min(exit, at + step)
        const mid = (at + end) / 2
        sum += huToMu(sample(sx + d[0] * mid, sy + d[1] * mid, sz + d[2] * mid)) * (end - at)
      }
      lineIntegral[row * sizePx + col] = sum * PROJECTION_MU_SCALE
    }
  }
  return { sizePx, fieldMm, centreUv, lineIntegral }
}

/** RGBA pixels for a canvas: the display curve, with an optional mask drawn as the unexposed dark. */
export function projectionPixels(
  lineIntegral: Float32Array,
  options: { readonly exposed?: Uint8Array } = {},
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(lineIntegral.length * 4)
  for (let i = 0; i < lineIntegral.length; i++) {
    const inside = options.exposed ? options.exposed[i] === 1 : true
    const gray = inside ? Math.round(projectionDisplay(lineIntegral[i]) * 255) : 10
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = gray
    pixels[i * 4 + 3] = 255
  }
  return pixels
}

/**
 * A square collimated field of `fieldMm` detector millimetres centred on the image centre: 1 inside,
 * 0 outside. The edge the tight frame shows is this square's edge.
 */
export function collimatedField(image: Pick<CtProjection, 'sizePx' | 'fieldMm'>, fieldMm: number) {
  const exposed = new Uint8Array(image.sizePx * image.sizePx)
  const half = (fieldMm / image.fieldMm) * (image.sizePx / 2)
  const lowEdge = image.sizePx / 2 - half
  const highEdge = image.sizePx / 2 + half
  for (let row = 0; row < image.sizePx; row++)
    for (let col = 0; col < image.sizePx; col++)
      if (
        col + 0.5 >= lowEdge &&
        col + 0.5 <= highEdge &&
        row + 0.5 >= lowEdge &&
        row + 0.5 <= highEdge
      )
        exposed[row * image.sizePx + col] = 1
  return { exposed, edgePx: { low: lowEdge, high: highEdge } }
}
