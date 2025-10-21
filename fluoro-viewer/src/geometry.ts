import type { Mat3, Vec3 } from './types'

const EPS = 1e-6

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function createRotationMatrix(raoLaoDeg: number, cranialCaudalDeg: number): Mat3 {
  const rz = createRz(degToRad(raoLaoDeg))
  const rx = createRx(degToRad(cranialCaudalDeg))
  return multiplyMat3(rx, rz)
}

export function createRz(theta: number): Mat3 {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ]
}

export function createRx(theta: number): Mat3 {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ]
}

export function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c]
    }
  }
  return out
}

export function rotateVec(matrix: Mat3, v: Vec3): Vec3 {
  return [
    matrix[0][0] * v[0] + matrix[0][1] * v[1] + matrix[0][2] * v[2],
    matrix[1][0] * v[0] + matrix[1][1] * v[1] + matrix[1][2] * v[2],
    matrix[2][0] * v[0] + matrix[2][1] * v[1] + matrix[2][2] * v[2],
  ]
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v)
  if (len < EPS) return [0, 0, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function clamp01(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}
