import metadata from '../../../../public/peripheral-imaging/anatomy/dts.json'
import gridMetadata from '../../../../public/peripheral-imaging/anatomy/dts-grid.json'
import { radians } from './physics'

export const DTS = metadata
/** The off-centre projections: one atlas on a 5/6° grid, loaded only when the arc's centre moves. */
export const DTS_GRID = gridMetadata
const GRID_STEP_DEG = DTS_GRID.angleStepDeg.numerator / DTS_GRID.angleStepDeg.denominator
let cached: Promise<Uint8ClampedArray> | undefined
export function loadDtsProjections() {
  if (!cached)
    cached = (async () => {
      const response = await fetch('/peripheral-imaging/anatomy/dts-projections.png')
      if (!response.ok) throw new Error('Teaching projections unavailable')
      const bitmap = await createImageBitmap(await response.blob())
      const canvas = document.createElement('canvas')
      canvas.width = DTS.tileSize * DTS.viewsPerSweep
      canvas.height = DTS.tileSize * DTS.sweeps.length
      if (bitmap.width !== canvas.width || bitmap.height !== canvas.height)
        throw new Error('Projection atlas dimensions differ from the manifest')
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      canvas.width = canvas.height = 0
      return rgba
    })().catch((error: unknown) => {
      cached = undefined
      throw error
    })
  return cached
}

/** Map a point in a chosen world-depth plane into a parallel projection. */
export function dtsDetectorCoordinate(horizontalMm: number, depthMm: number, angle: number) {
  return horizontalMm * Math.cos(radians(angle)) + depthMm * Math.sin(radians(angle))
}
export function dtsPixel(
  data: Uint8ClampedArray,
  sweep: number,
  view: number,
  u: number,
  v: number,
) {
  const size = DTS.tileSize
  if (u < 0 || v < 0 || u >= size - 1 || v >= size - 1) return 0
  const x = Math.floor(u),
    y = Math.floor(v),
    fx = u - x,
    fy = v - y
  const row = DTS.sweeps.indexOf(sweep)
  if (row < 0) return 0
  const width = size * DTS.viewsPerSweep
  const at = (dx: number, dy: number) =>
    data[((row * size + y + dy) * width + view * size + x + dx) * 4]
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy
  )
}
export function reconstructTeachingPlane(
  data: Uint8ClampedArray,
  sweep: number,
  plane: number,
  size = 256,
) {
  const pixels = new Uint8ClampedArray(size * size * 4)
  const angles = Array.from(
    { length: DTS.viewsPerSweep },
    (_, i) => -sweep / 2 + (sweep * i) / (DTS.viewsPerSweep - 1),
  )
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const x = DTS.targetCenterMm[0] - 20 + ((col - size / 2) * 140) / size
      const z = DTS.targetCenterMm[2] + ((size / 2 - row) * 140) / size
      let sum = 0
      for (let i = 0; i < angles.length; i++) {
        const u = dtsDetectorCoordinate(x, DTS.targetCenterMm[1] + plane, angles[i])
        sum += dtsPixel(
          data,
          sweep,
          i,
          (u - DTS.originMm[0]) / DTS.spacingMm[0],
          (z - DTS.originMm[2]) / DTS.spacingMm[2],
        )
      }
      // One fixed display window for every sweep and depth, never per-image normalization.
      const gray = Math.max(0, Math.min(255, (sum / angles.length - 128) * 2.4 + 95))
      const index = (row * size + col) * 4
      pixels[index] = pixels[index + 1] = pixels[index + 2] = gray
      pixels[index + 3] = 255
    }
  return pixels
}

/** The thirteen view angles of an arc of `sweep` degrees centred on `centre`. */
export function dtsSweepAngles(sweep: number, centre = 0): number[] {
  return Array.from(
    { length: DTS.viewsPerSweep },
    (_, i) => centre - sweep / 2 + (sweep * i) / (DTS.viewsPerSweep - 1),
  )
}

/** The grid tile holding a view angle, or null when the angle is off the grid. */
export function dtsGridTile(angle: number): number | null {
  const k = Math.round(angle / GRID_STEP_DEG)
  if (Math.abs(k * GRID_STEP_DEG - angle) > 1e-6) return null
  if (k < DTS_GRID.kMin || k > DTS_GRID.kMax) return null
  return k - DTS_GRID.kMin
}

let cachedGrid: Promise<Uint8ClampedArray> | undefined
export function loadDtsGrid() {
  if (!cachedGrid)
    cachedGrid = (async () => {
      const response = await fetch('/peripheral-imaging/anatomy/dts-grid.png')
      if (!response.ok) throw new Error('Off-centre projections unavailable')
      const bitmap = await createImageBitmap(await response.blob())
      const tiles = DTS_GRID.kMax - DTS_GRID.kMin + 1
      const canvas = document.createElement('canvas')
      canvas.width = DTS_GRID.tileSize * DTS_GRID.columns
      canvas.height = DTS_GRID.tileSize * Math.ceil(tiles / DTS_GRID.columns)
      if (bitmap.width !== canvas.width || bitmap.height !== canvas.height)
        throw new Error('Off-centre projection atlas dimensions differ from the manifest')
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      canvas.width = canvas.height = 0
      return rgba
    })().catch((error: unknown) => {
      cachedGrid = undefined
      throw error
    })
  return cachedGrid
}

/** One grid tile's pixel, bilinear, in the same coordinates as `dtsPixel`. */
export function dtsGridPixel(data: Uint8ClampedArray, tile: number, u: number, v: number) {
  const size = DTS_GRID.tileSize
  if (u < 0 || v < 0 || u >= size - 1 || v >= size - 1) return 0
  const x = Math.floor(u),
    y = Math.floor(v),
    fx = u - x,
    fy = v - y
  const row = Math.floor(tile / DTS_GRID.columns),
    col = tile % DTS_GRID.columns
  const width = size * DTS_GRID.columns
  const at = (dx: number, dy: number) =>
    data[((row * size + y + dy) * width + col * size + x + dx) * 4]
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy
  )
}

/**
 * The axes of the reconstructed plane for an arc centred on `centre`: across the image (the
 * detector's horizontal at the centre of the arc) and through depth (the beam at the centre).
 * Planes lie square to the beam at the centre of the arc, so moving the centre tilts them.
 */
export function dtsPlaneAxes(centre: number) {
  const c = radians(centre)
  return {
    across: [Math.cos(c), Math.sin(c), 0] as const,
    depth: [-Math.sin(c), Math.cos(c), 0] as const,
  }
}

/**
 * Shift-and-add for an arc centred anywhere on the grid: the same 140 mm plane, display window and
 * parallel geometry as `reconstructTeachingPlane`, with the plane square to the arc's centre. At a
 * centre of 0° it is that function, pixel for pixel.
 */
export function reconstructOffCentrePlane(
  grid: Uint8ClampedArray,
  sweep: number,
  centre: number,
  plane: number,
  size = 256,
) {
  const pixels = new Uint8ClampedArray(size * size * 4)
  const angles = dtsSweepAngles(sweep, centre)
  const tiles = angles.map(dtsGridTile)
  if (tiles.some((tile) => tile === null)) return null
  const { across, depth } = dtsPlaneAxes(centre)
  const [tx, ty, tz] = DTS.targetCenterMm
  const cos = angles.map((a) => Math.cos(radians(a)))
  const sin = angles.map((a) => Math.sin(radians(a)))
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const s = -20 + ((col - size / 2) * 140) / size
      const z = tz + ((size / 2 - row) * 140) / size
      const px = tx + s * across[0] + plane * depth[0]
      const py = ty + s * across[1] + plane * depth[1]
      let sum = 0
      for (let i = 0; i < angles.length; i++) {
        const u = px * cos[i] + py * sin[i]
        sum += dtsGridPixel(
          grid,
          tiles[i]!,
          (u - DTS.originMm[0]) / DTS.spacingMm[0],
          (z - DTS.originMm[2]) / DTS.spacingMm[2],
        )
      }
      const gray = Math.max(0, Math.min(255, (sum / angles.length - 128) * 2.4 + 95))
      const index = (row * size + col) * 4
      pixels[index] = pixels[index + 1] = pixels[index + 2] = gray
      pixels[index + 3] = 255
    }
  return pixels
}
