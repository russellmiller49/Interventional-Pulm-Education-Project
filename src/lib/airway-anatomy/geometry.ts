import type { CtAxis, CtPreviewAsset, Vec3 } from './types'

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function scale(v: Vec3, scalar: number): Vec3 {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

export function normalize(v: Vec3, fallback: Vec3 = [0, 0, -1]): Vec3 {
  const magnitude = length(v)
  if (magnitude < 1e-8) return fallback
  return [v[0] / magnitude, v[1] / magnitude, v[2] / magnitude]
}

export function distance(a: Vec3, b: Vec3): number {
  return length(subtract(a, b))
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Rodrigues rotation of `v` around a (not necessarily unit) `axis` by `angleRad`. */
export function rotateAroundAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  if (angleRad === 0) return v
  const a = normalize(axis)
  const cosA = Math.cos(angleRad)
  const sinA = Math.sin(angleRad)
  const term1 = scale(v, cosA)
  const term2 = scale(cross(a, v), sinA)
  const term3 = scale(a, dot(a, v) * (1 - cosA))
  return add(add(term1, term2), term3)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function parseNrrdHeaderText(text: string): Record<string, string> {
  const header: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('NRRD')) continue
    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue
    header[trimmed.slice(0, separator).trim().toLowerCase()] = trimmed.slice(separator + 1).trim()
  }
  return header
}

export function lpsToCtIndex(lps: Vec3, ct: CtPreviewAsset): Vec3 {
  const indexMatrix = indexToWorldMatrix(ct)
  const inverse = invertMat3(indexMatrix)
  return multiplyMat3Vec(inverse, subtract(lps, ct.originLps))
}

export function ctIndexToLps(index: Vec3, ct: CtPreviewAsset): Vec3 {
  return add(ct.originLps, multiplyMat3Vec(indexToWorldMatrix(ct), index))
}

export function ctAxisLength(ct: CtPreviewAsset, axis: CtAxis): number {
  if (axis === 'axial') return ct.sizeXyz[2]
  if (axis === 'coronal') return ct.sizeXyz[1]
  return ct.sizeXyz[0]
}

export function ctCanvasDimensions(
  ct: CtPreviewAsset,
  axis: CtAxis,
): { width: number; height: number } {
  const [sx, sy, sz] = ct.sizeXyz
  if (axis === 'axial') return { width: sx, height: sy }
  if (axis === 'coronal') return { width: sx, height: sz }
  return { width: sy, height: sz }
}

export function ctCanvasPixelToIndex(
  x: number,
  y: number,
  axis: CtAxis,
  sliceIndex: number,
  ct: CtPreviewAsset,
): Vec3 {
  const [sx, sy, sz] = ct.sizeXyz
  if (axis === 'axial') {
    return [
      clamp(Math.round(x), 0, sx - 1),
      clamp(Math.round(y), 0, sy - 1),
      clamp(sliceIndex, 0, sz - 1),
    ]
  }
  if (axis === 'coronal') {
    return [
      clamp(Math.round(x), 0, sx - 1),
      clamp(sliceIndex, 0, sy - 1),
      clamp(Math.round(sz - 1 - y), 0, sz - 1),
    ]
  }
  return [
    clamp(sliceIndex, 0, sx - 1),
    clamp(Math.round(x), 0, sy - 1),
    clamp(Math.round(sz - 1 - y), 0, sz - 1),
  ]
}

export function projectLpsToCanvas(
  lps: Vec3,
  axis: CtAxis,
  sliceIndex: number,
  ct: CtPreviewAsset,
  width: number,
  height: number,
): { x: number; y: number; distanceFromSlice: number; inFrame: boolean } {
  const [i, j, k] = lpsToCtIndex(lps, ct)
  const [sx, sy, sz] = ct.sizeXyz
  let x = 0
  let y = 0
  let depth = 0
  if (axis === 'axial') {
    x = (i / Math.max(sx - 1, 1)) * width
    y = (j / Math.max(sy - 1, 1)) * height
    depth = k
  } else if (axis === 'coronal') {
    x = (i / Math.max(sx - 1, 1)) * width
    y = (1 - k / Math.max(sz - 1, 1)) * height
    depth = j
  } else {
    x = (j / Math.max(sy - 1, 1)) * width
    y = (1 - k / Math.max(sz - 1, 1)) * height
    depth = i
  }
  return {
    x,
    y,
    distanceFromSlice: Math.abs(depth - sliceIndex),
    inFrame: x >= 0 && x <= width && y >= 0 && y <= height,
  }
}

export function windowHu(value: number, low: number, high: number): number {
  const normalized = (value - low) / Math.max(high - low, 1)
  return Math.round(clamp(normalized, 0, 1) * 255)
}

type Mat3 = [Vec3, Vec3, Vec3]

function indexToWorldMatrix(ct: CtPreviewAsset): Mat3 {
  const direction = ct.directionLps.length === 9 ? ct.directionLps : [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const [sx, sy, sz] = ct.spacingXyzMm
  return [
    [direction[0] * sx, direction[3] * sy, direction[6] * sz],
    [direction[1] * sx, direction[4] * sy, direction[7] * sz],
    [direction[2] * sx, direction[5] * sy, direction[8] * sz],
  ]
}

function multiplyMat3Vec(matrix: Mat3, vector: Vec3): Vec3 {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ]
}

function invertMat3(matrix: Mat3): Mat3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (Math.abs(determinant) < 1e-10) {
    throw new Error('CT direction matrix is not invertible.')
  }
  const inv = 1 / determinant
  return [
    [(e * i - f * h) * inv, (c * h - b * i) * inv, (b * f - c * e) * inv],
    [(f * g - d * i) * inv, (a * i - c * g) * inv, (c * d - a * f) * inv],
    [(d * h - e * g) * inv, (b * g - a * h) * inv, (a * e - b * d) * inv],
  ]
}
