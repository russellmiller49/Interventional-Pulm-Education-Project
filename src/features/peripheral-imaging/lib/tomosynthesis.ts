import metadata from '../../../../public/peripheral-imaging/anatomy/dts.json'
import { radians } from './physics'

export const DTS = metadata
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
