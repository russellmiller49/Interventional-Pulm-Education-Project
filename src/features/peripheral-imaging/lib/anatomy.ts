import type { FluoroConfig, VolumeDrrAsset } from '@fluoroview/types'
import metadata from '../../../../public/peripheral-imaging/anatomy/manifest.json'
import { DETECTOR_DISTANCE, DETECTOR_FIELD, SOURCE_DISTANCE, type Point3 } from './physics'

export const ANATOMY = metadata
export const ANATOMY_MODEL = '/peripheral-imaging/anatomy/thorax.glb'
export const CT_ATLAS = '/peripheral-imaging/anatomy/ct-atlas.png'
export const IMAGING_CONFIG: FluoroConfig = {
  units: 'mm',
  coordinateSystem: 'LAS',
  isocenter_mm: [0, 0, 0],
  source_to_isocenter_mm: SOURCE_DISTANCE,
  source_to_detector_mm: DETECTOR_DISTANCE,
  detector_pixels: [800, 800],
  pixel_pitch_mm: DETECTOR_FIELD / 800,
  default_view: { rao_lao_deg: 0, cranial_caudal_deg: 0 },
}
export const VOLUME_ASSET: VolumeDrrAsset = {
  volumeUri: CT_ATLAS,
  format: 'uint8-r8',
  sizeXyz: metadata.sizeXyz as Point3,
  // The ray marcher expects the outside voxel face; the atlas manifest stores voxel centers.
  originLps: metadata.originMm.map((v, i) => v - metadata.spacingMm[i] / 2) as Point3,
  spacingXyzMm: metadata.spacingMm as Point3,
  directionLps: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  huRange: metadata.huRange as [number, number],
  sampleDomain: 'normalized-r8',
  baselineMas: 16,
  recommendedSteps: { interactive: 96, full: 240 },
  recommendedRenderScale: { interactive: 0.55, full: 0.9 },
}

let cached: Promise<Uint8Array> | undefined
/** Shared decode: one downloaded PNG atlas, no raw medical headers or remote data service. */
export function loadAnatomyVolume() {
  if (!cached)
    cached = (async () => {
      const response = await fetch(CT_ATLAS)
      if (!response.ok) throw new Error('Teaching CT atlas unavailable')
      const bitmap = await createImageBitmap(await response.blob())
      const [sx, sy, sz] = metadata.sizeXyz
      const width = sx * metadata.atlasColumns,
        height = sy * metadata.atlasRows
      if (bitmap.width !== width || bitmap.height !== height)
        throw new Error('Teaching atlas dimensions differ from its manifest')
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Image decode unavailable')
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const rgba = ctx.getImageData(0, 0, width, height).data
      const volume = new Uint8Array(sx * sy * sz)
      for (let z = 0; z < sz; z++) {
        const col = z % metadata.atlasColumns,
          row = Math.floor(z / metadata.atlasColumns)
        for (let y = 0; y < sy; y++)
          for (let x = 0; x < sx; x++)
            volume[(z * sy + y) * sx + x] = rgba[((row * sy + y) * width + col * sx + x) * 4]
      }
      canvas.width = canvas.height = 0
      return volume
    })().catch((error: unknown) => {
      cached = undefined
      throw error
    })
  return cached
}
export function sampleAnatomy(volume: Uint8Array, point: Point3) {
  const p = point.map((n, i) => (n - metadata.originMm[i]) / metadata.spacingMm[i])
  if (p.some((n, i) => n < 0 || n >= metadata.sizeXyz[i] - 1)) return -1000
  const [x, y, z] = p.map(Math.floor),
    [fx, fy, fz] = p.map((n, i) => n - [x, y, z][i])
  const row = metadata.sizeXyz[0],
    plane = row * metadata.sizeXyz[1],
    base = z * plane + y * row + x
  const low =
    (volume[base] * (1 - fx) + volume[base + 1] * fx) * (1 - fy) +
    (volume[base + row] * (1 - fx) + volume[base + row + 1] * fx) * fy
  const high =
    (volume[base + plane] * (1 - fx) + volume[base + plane + 1] * fx) * (1 - fy) +
    (volume[base + plane + row] * (1 - fx) + volume[base + plane + row + 1] * fx) * fy
  const value = low * (1 - fz) + high * fz
  return metadata.huRange[0] + (value / 255) * (metadata.huRange[1] - metadata.huRange[0])
}
