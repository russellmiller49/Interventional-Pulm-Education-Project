import { plus, minus, times, scalar, vector, unit, type OpticalFrame, type Point3 } from './frame'

export type SliceAxis = 'axial' | 'coronal' | 'sagittal' | 'oblique'
export interface CtGeometry {
  sizeXyz: Point3
  spacingXyzMm: Point3
  originLps: Point3
  /** Row-major direction cosine matrix, columns correspond to I, J, K. */
  directionLps: number[]
}
export interface NativeBricks {
  baseUrl: string
  brickSize: number
  sizeXyz: Point3
  spacingXyzMm: Point3
}
export interface SlicePlane {
  axis: SliceAxis
  center: Point3
  right: Point3
  down: Point3
  normal: Point3
  widthMm: number
  heightMm: number
  width: number
  height: number
}
export function voxelToPatient(g: CtGeometry, ijk: Point3): Point3 {
  const d = g.directionLps,
    p = ijk.map((v, i) => v * g.spacingXyzMm[i])
  return plus(g.originLps, [
    d[0] * p[0] + d[1] * p[1] + d[2] * p[2],
    d[3] * p[0] + d[4] * p[1] + d[5] * p[2],
    d[6] * p[0] + d[7] * p[1] + d[8] * p[2],
  ])
}
export function patientToVoxel(g: CtGeometry, point: Point3): Point3 {
  const d = g.directionLps,
    a: Point3 = [d[0], d[3], d[6]],
    b: Point3 = [d[1], d[4], d[7]],
    c: Point3 = [d[2], d[5], d[8]]
  const det = scalar(a, vector(b, c))
  if (Math.abs(det) < 1e-9) throw new Error('Singular CT direction matrix')
  const p = minus(point, g.originLps)
  return [
    scalar(p, vector(b, c)) / det / g.spacingXyzMm[0],
    scalar(p, vector(c, a)) / det / g.spacingXyzMm[1],
    scalar(p, vector(a, b)) / det / g.spacingXyzMm[2],
  ]
}
export function trilinear(
  g: CtGeometry,
  ijk: Point3,
  read: (i: number, j: number, k: number) => number,
): number {
  if (ijk.some((v, i) => v < 0 || v > g.sizeXyz[i] - 1)) return -1024
  const a = ijk.map(Math.floor),
    f = ijk.map((v, i) => v - a[i])
  let result = 0
  for (let z = 0; z < 2; z++)
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        result +=
          read(
            Math.min(a[0] + x, g.sizeXyz[0] - 1),
            Math.min(a[1] + y, g.sizeXyz[1] - 1),
            Math.min(a[2] + z, g.sizeXyz[2] - 1),
          ) *
          (x ? f[0] : 1 - f[0]) *
          (y ? f[1] : 1 - f[1]) *
          (z ? f[2] : 1 - f[2])
      }
  return result
}
export function makeSlicePlane(
  g: CtGeometry,
  axis: SliceAxis,
  frame: OpticalFrame,
  zoom = 1,
  pan: [number, number] = [0, 0],
  offsetMm = 0,
  pixels = 384,
): SlicePlane {
  const right: Point3 =
    axis === 'oblique' ? frame.right : axis === 'sagittal' ? [0, 1, 0] : [1, 0, 0]
  const down: Point3 =
    axis === 'oblique' ? times(frame.up, -1) : axis === 'axial' ? [0, 1, 0] : [0, 0, -1]
  const normal = unit(vector(right, down)),
    origin = frame.position
  const corners: Point3[] = []
  for (const i of [0, g.sizeXyz[0] - 1])
    for (const j of [0, g.sizeXyz[1] - 1])
      for (const k of [0, g.sizeXyz[2] - 1]) corners.push(voxelToPatient(g, [i, j, k]))
  const xs = corners.map((p) => scalar(minus(p, origin), right)),
    ys = corners.map((p) => scalar(minus(p, origin), down))
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys)
  const widthMm = (maxX - minX) / zoom,
    heightMm = (maxY - minY) / zoom
  // Zoom converges on the scope, keeping the target in view without moving the slice plane.
  const center = plus(
    plus(
      plus(origin, times(right, (minX + maxX) / 2 / zoom + pan[0])),
      times(down, (minY + maxY) / 2 / zoom + pan[1]),
    ),
    times(normal, offsetMm),
  )
  const factor = pixels / Math.max(widthMm, heightMm)
  return {
    axis,
    center,
    right,
    down,
    normal,
    widthMm,
    heightMm,
    width: Math.max(2, Math.round(widthMm * factor)),
    height: Math.max(2, Math.round(heightMm * factor)),
  }
}
export function slicePixelToPatient(p: SlicePlane, x: number, y: number): Point3 {
  return plus(
    plus(p.center, times(p.right, (x / (p.width - 1) - 0.5) * p.widthMm)),
    times(p.down, (y / (p.height - 1) - 0.5) * p.heightMm),
  )
}
export function patientToSlicePixel(p: SlicePlane, point: Point3) {
  const d = minus(point, p.center)
  return {
    x: (scalar(d, p.right) / p.widthMm + 0.5) * (p.width - 1),
    y: (scalar(d, p.down) / p.heightMm + 0.5) * (p.height - 1),
    offPlaneMm: scalar(d, p.normal),
  }
}
export function orientationLabel(direction: Point3): string {
  const labels = [
    direction[0] > 0 ? 'L' : 'R',
    direction[1] > 0 ? 'P' : 'A',
    direction[2] > 0 ? 'S' : 'I',
  ]
  return direction
    .map((v, i) => ({ v: Math.abs(v), label: labels[i] }))
    .filter((v) => v.v > 0.2)
    .sort((a, b) => b.v - a.v)
    .map((v) => v.label)
    .join('')
}
export function reslice(
  p: SlicePlane,
  low: number,
  high: number,
  sample: (point: Point3) => number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(p.width * p.height * 4),
    range = Math.max(high - low, 1)
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const gray = Math.round(
          Math.max(0, Math.min(1, (sample(slicePixelToPatient(p, x, y)) - low) / range)) * 255,
        ),
        i = (y * p.width + x) * 4
      rgba[i] = gray
      rgba[i + 1] = gray
      rgba[i + 2] = gray
      rgba[i + 3] = 255
    }
  return rgba
}
