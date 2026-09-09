/** Quantized CT density bands on a geometric ray, not a spectrum, exposure or dose model. */
import { ANATOMY, sampleAnatomy } from './anatomy'
import { LESION_CENTER, LESION_RADIUS, clamp, type Point3 } from './physics'

export type RayTissue = 'air' | 'lung' | 'soft' | 'bone' | 'target'
export const RAY_TISSUES: Record<RayTissue, { label: string; color: string }> = {
  air: { label: 'Air-like CT', color: '#8299aa' },
  lung: { label: 'Aerated-lung-like CT', color: '#61bdbe' },
  soft: { label: 'Soft-tissue-like CT', color: '#d28b93' },
  bone: { label: 'Bone-like CT', color: '#ece0bd' },
  target: { label: 'Authored target', color: '#e8b86c' },
}
export interface RaySegment {
  start: Point3
  end: Point3
  tissue: RayTissue
  lengthMm: number
  meanHu: number
}
export interface RayProfile {
  segments: readonly RaySegment[]
  tissueMm: Record<RayTissue, number>
  pathMm: number
  rayTissueMm: number
  relativeAttenuation: number
}
export function densityBand(hu: number): RayTissue {
  return hu < -950 ? 'air' : hu < -450 ? 'lung' : hu < 180 ? 'soft' : 'bone'
}
/** Midpoint integration uses exact interval lengths, including the final partial step. */
export function rayProfile(
  volume: Uint8Array,
  source: Point3,
  detector: Point3,
  options?: {
    stepMm?: number
    sampleHu?: (point: Point3) => number
    tagAuthoredTarget?: boolean
  },
): RayProfile {
  const delta = detector.map((v, i) => v - source[i]) as Point3
  const length = Math.hypot(...delta),
    direction = delta.map((v) => v / length)
  const tissueMm: Record<RayTissue, number> = { air: 0, lung: 0, soft: 0, bone: 0, target: 0 }
  const empty = { segments: [], tissueMm, pathMm: 0, rayTissueMm: 0, relativeAttenuation: 0 }
  if (!Number.isFinite(length) || length === 0) return empty
  let entry = 0,
    exit = length
  for (let axis = 0; axis < 3; axis++) {
    const low = ANATOMY.originMm[axis],
      high = low + ANATOMY.spacingMm[axis] * (ANATOMY.sizeXyz[axis] - 1)
    if (Math.abs(direction[axis]) < 1e-12) {
      if (source[axis] < low || source[axis] > high) return empty
      continue
    }
    const a = (low - source[axis]) / direction[axis],
      b = (high - source[axis]) / direction[axis]
    entry = Math.max(entry, Math.min(a, b))
    exit = Math.min(exit, Math.max(a, b))
  }
  if (exit <= entry) return empty
  const point = (distance: number) => source.map((v, i) => v + direction[i] * distance) as Point3
  const step = clamp(options?.stepMm ?? 1, 0.25, 5)
  const sample = options?.sampleHu ?? ((p: Point3) => sampleAnatomy(volume, p))
  const segments: RaySegment[] = []
  let attenuation = 0
  for (let at = entry; at < exit; at += step) {
    const end = Math.min(exit, at + step),
      mid = point((at + end) / 2),
      ds = end - at
    const hu = sample(mid)
    const tissue: RayTissue =
      options?.tagAuthoredTarget !== false &&
      Math.hypot(...mid.map((v, i) => v - LESION_CENTER[i])) <= LESION_RADIUS
        ? 'target'
        : densityBand(hu)
    tissueMm[tissue] += ds
    attenuation += Math.max(0, (hu + 1000) / 1000) * ds
    const previous = segments[segments.length - 1]
    if (previous?.tissue === tissue) {
      previous.meanHu = (previous.meanHu * previous.lengthMm + hu * ds) / (previous.lengthMm + ds)
      previous.lengthMm += ds
      previous.end = point(end)
    } else segments.push({ start: point(at), end: point(end), tissue, lengthMm: ds, meanHu: hu })
  }
  return {
    segments,
    tissueMm,
    pathMm: exit - entry,
    rayTissueMm: tissueMm.soft + tissueMm.bone,
    relativeAttenuation: attenuation,
  }
}
