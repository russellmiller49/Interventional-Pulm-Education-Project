import type { Point3 } from './frame'

export type AcousticKind = 'air' | 'soft' | 'blood' | 'node' | 'wall'
export interface AcousticLabel {
  id: number
  key: string
  label: string
  kind: AcousticKind
}
export interface AcousticVolumeMetadata {
  schema: 'acoustic-volume/v1'
  assetVersion: string
  coordinateSystem: 'LPS'
  units: 'mm'
  sourceGeometrySha256: string
  dataSha256: string
  decodedSha256: string
  sizeXyz: Point3
  spacingXyzMm: Point3
  originLps: Point3
  labels: AcousticLabel[]
}
export interface AcousticVolume {
  metadata: AcousticVolumeMetadata
  data: Uint8Array
}
export interface AcousticPose {
  originLps: Point3
  depthAxisLps: Point3
  lateralAxisLps: Point3
}
export interface AcousticControls {
  depthMm: number
  gainDb: number
  tgcDb: [number, number, number]
  contactQuality: number
  sectorAngleDeg: number
  frequencyMHz: number
}
export interface AcousticFrame {
  rgba: Uint8ClampedArray
  labelImage: Uint8Array
  width: number
  height: number
  structures: Array<{ id: number; count: number; x: number; y: number }>
  pose: AcousticPose
  controls: AcousticControls
}
export const DEFAULT_ACOUSTIC_CONTROLS: AcousticControls = {
  depthMm: 40,
  gainDb: 0,
  tgcDb: [0, 12, 24],
  contactQuality: 1,
  sectorAngleDeg: 60,
  frequencyMHz: 7.5,
}
const MEDIA: Record<AcousticKind, { impedance: number; scatter: number; attenuation: number }> = {
  air: { impedance: 0.0004, scatter: 0.006, attenuation: 18 },
  soft: { impedance: 1.63, scatter: 0.72, attenuation: 0.6 },
  blood: { impedance: 1.61, scatter: 0.024, attenuation: 0.18 },
  node: { impedance: 1.58, scatter: 0.39, attenuation: 0.7 },
  wall: { impedance: 1.75, scatter: 1.05, attenuation: 1 },
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function hash(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** A patient-anchored scatter field: no frame number, wall clock or random seed per render. */
export function coherentSpeckle(x: number, y: number, z: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z)
  let fx = x - ix,
    fy = y - iy,
    fz = z - iz
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  fz = fz * fz * (3 - 2 * fz)
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  return mix(
    mix(
      mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx),
      mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx),
      fy,
    ),
    mix(
      mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx),
      mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx),
      fy,
    ),
    fz,
  )
}
export function acousticLabelAt(volume: AcousticVolume, x: number, y: number, z: number): number {
  const m = volume.metadata
  const i = Math.round((x - m.originLps[0]) / m.spacingXyzMm[0]),
    j = Math.round((y - m.originLps[1]) / m.spacingXyzMm[1]),
    k = Math.round((z - m.originLps[2]) / m.spacingXyzMm[2])
  if (i < 0 || j < 0 || k < 0 || i >= m.sizeXyz[0] || j >= m.sizeXyz[1] || k >= m.sizeXyz[2])
    return 0
  return volume.data[(k * m.sizeXyz[1] + j) * m.sizeXyz[0] + i]
}
// Interpolate acoustic properties, not integer label IDs. This preserves each
// anatomical region while removing the staircase produced by nearest-voxel walls.
function sampleMedium(
  volume: AcousticVolume,
  media: Array<typeof MEDIA.soft>,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
) {
  const m = volume.metadata,
    nx = m.sizeXyz[0],
    ny = m.sizeXyz[1]
  const vx = (x - m.originLps[0]) / m.spacingXyzMm[0],
    vy = (y - m.originLps[1]) / m.spacingXyzMm[1],
    vz = (z - m.originLps[2]) / m.spacingXyzMm[2]
  const ix = Math.floor(vx),
    iy = Math.floor(vy),
    iz = Math.floor(vz),
    fx = vx - ix,
    fy = vy - iy,
    fz = vz - iz
  out.fill(0)
  for (let k = 0; k < 2; k++)
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const weight = (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * (k ? fz : 1 - fz),
          a = ix + i,
          b = iy + j,
          c = iz + k
        const id =
          a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= m.sizeXyz[2]
            ? 0
            : volume.data[(c * ny + b) * nx + a]
        const medium = media[id] ?? MEDIA.air
        out[0] += medium.impedance * weight
        out[1] += medium.scatter * weight
        out[2] += medium.attenuation * weight
        if (id <= 2 && id !== 1) out[3] += weight
      }
}
export function validateAcousticVolume(
  metadata: AcousticVolumeMetadata,
  data: Uint8Array,
  expected: { assetVersion: string; sourceGeometrySha256: string },
) {
  if (
    metadata.schema !== 'acoustic-volume/v1' ||
    metadata.coordinateSystem !== 'LPS' ||
    metadata.units !== 'mm'
  )
    throw new Error('Unsupported acoustic coordinates')
  if (
    metadata.assetVersion !== expected.assetVersion ||
    metadata.sourceGeometrySha256 !== expected.sourceGeometrySha256
  )
    throw new Error('Acoustic volume does not match the active anatomy')
  if (
    metadata.sizeXyz.reduce((a, b) => a * b, 1) !== data.length ||
    metadata.spacingXyzMm.some((s) => s <= 0)
  )
    throw new Error('Invalid acoustic volume dimensions')
}
/**
 * Simplified pulse/echo model, intentionally separate from diagnostic ultrasound.
 * Polar beams integrate attenuation and interface echoes before scan conversion.
 * Low attenuation in blood produces relative enhancement behind a vessel; air
 * interfaces attenuate downstream energy. A compact PSF suppresses voxel edges.
 */
export function renderAcousticFrame(
  volume: AcousticVolume,
  pose: AcousticPose,
  input: AcousticControls,
  width = 384,
  height = 384,
  beamCount = 160,
  depthSamples = 256,
): AcousticFrame {
  const controls = {
    ...input,
    depthMm: clamp(input.depthMm, 15, 80),
    gainDb: clamp(input.gainDb, -24, 30),
    contactQuality: clamp(input.contactQuality, 0, 1),
  }
  const polar = new Float32Array(beamCount * depthSamples),
    polarLabels = new Uint8Array(polar.length)
  const media = volume.metadata.labels.map((l) => MEDIA[l.kind]),
    sampled = new Float64Array(4)
  const step = controls.depthMm / (depthSamples - 1),
    halfAngle = (controls.sectorAngleDeg * Math.PI) / 360
  const coupling = controls.contactQuality ** 1.7
  for (let beam = 0; beam < beamCount; beam++) {
    const angle = -halfAngle + (2 * halfAngle * beam) / (beamCount - 1),
      c = Math.cos(angle),
      s = Math.sin(angle)
    const dx = pose.depthAxisLps[0] * c + pose.lateralAxisLps[0] * s,
      dy = pose.depthAxisLps[1] * c + pose.lateralAxisLps[1] * s,
      dz = pose.depthAxisLps[2] * c + pose.lateralAxisLps[2] * s
    let energy = 1,
      priorImpedance = 0,
      priorScatter = 0,
      echoTail = 0,
      wallSeen = false
    for (let sample = 0; sample < depthSamples; sample++) {
      const distance = sample * step,
        x = pose.originLps[0] + dx * distance,
        y = pose.originLps[1] + dy * distance,
        z = pose.originLps[2] + dz * distance
      const id = acousticLabelAt(volume, x, y, z)
      sampleMedium(volume, media, x, y, z, sampled)
      const impedance = sampled[0],
        scatter = sampled[1],
        air = sampled[3]
      const coefficient = sample
        ? Math.abs((impedance - priorImpedance) / (impedance + priorImpedance + 0.0001))
        : 0
      const reflection = Math.min(
        0.8,
        coefficient * 3.5 + (sample && air < 0.15 ? Math.abs(scatter - priorScatter) * 1.4 : 0),
      )
      if (air < 0.15) wallSeen = true
      // Subvoxel placement at a contacting wall can begin just inside the lumen.
      const effectiveAttenuation = !wallSeen && distance < 3 ? 0 : sampled[2]
      energy *= Math.exp(
        ((-Math.LN10 / 20) * 2 * effectiveAttenuation * controls.frequencyMHz * step) / 10,
      )
      if (wallSeen) energy *= 1 - coefficient * coefficient * 0.85
      echoTail = echoTail * Math.exp(-step / 0.28) + reflection
      const noise = coherentSpeckle(x * 3.1, y * 3.1, z * 3.1)
      const envelope = Math.sqrt(-2 * Math.log(Math.max(0.002, noise)))
      const texture = 0.55 + 0.9 * coherentSpeckle(x * 0.75 + 17, y * 0.75, z * 0.75)
      const fraction = sample / (depthSamples - 1),
        half = fraction < 0.5 ? 0 : 1,
        t = (fraction - half * 0.5) * 2
      const tgc = controls.tgcDb[half] * (1 - t) + controls.tgcDb[half + 1] * t
      const gain = Math.pow(10, (controls.gainDb + tgc) / 20)
      let amplitude =
        (scatter * envelope * texture * 0.17 + echoTail * 0.9) * energy * gain * coupling
      if (distance < 2.5)
        amplitude +=
          (1 - coupling) * 0.35 * Math.exp(-distance / 1.4) * (0.5 + 0.5 * Math.cos(distance * 15))
      const value = clamp((Math.log1p(amplitude * 9) / Math.log(10)) * 255, 0, 255)
      const index = beam * depthSamples + sample
      polar[index] = value
      polarLabels[index] = id
      priorImpedance = impedance
      priorScatter = scatter
    }
  }
  // Finite axial/lateral point-spread function before scan conversion. It blurs
  // echoes rather than the segmentation, so anatomical caliber stays unchanged.
  const axial = new Float32Array(polar.length),
    filtered = new Float32Array(polar.length),
    weights = [1, 4, 6, 4, 1]
  for (let b = 0; b < beamCount; b++)
    for (let d = 0; d < depthSamples; d++) {
      let sum = 0
      for (let k = -2; k <= 2; k++)
        sum += polar[b * depthSamples + clamp(d + k, 0, depthSamples - 1)] * weights[k + 2]
      axial[b * depthSamples + d] = sum / 16
    }
  for (let b = 0; b < beamCount; b++)
    for (let d = 0; d < depthSamples; d++) {
      let sum = 0
      for (let k = -2; k <= 2; k++)
        sum += axial[clamp(b + k, 0, beamCount - 1) * depthSamples + d] * weights[k + 2]
      filtered[b * depthSamples + d] = sum / 16
    }
  const rgba = new Uint8ClampedArray(width * height * 4),
    labelImage = new Uint8Array(width * height)
  const radius = Math.min(height * 0.86, (width * 0.46) / Math.sin(halfAngle)),
    apexX = (width - 1) / 2,
    apexY = height * 0.075
  const structures = new Map<number, { id: number; count: number; x: number; y: number }>()
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const px = x - apexX,
        py = y - apexY,
        angle = Math.atan2(px, py),
        distance = Math.hypot(px, py) / radius
      const index = y * width + x,
        offset = index * 4
      rgba[offset + 3] = 255
      if (py < 0 || distance > 1 || Math.abs(angle) > halfAngle) continue
      const b = clamp(((angle + halfAngle) / (2 * halfAngle)) * (beamCount - 1), 0, beamCount - 1),
        d = distance * (depthSamples - 1)
      const b0 = Math.floor(b),
        d0 = Math.floor(d),
        b1 = Math.min(b0 + 1, beamCount - 1),
        d1 = Math.min(d0 + 1, depthSamples - 1),
        fb = b - b0,
        fd = d - d0
      const a = filtered[b0 * depthSamples + d0] * (1 - fd) + filtered[b0 * depthSamples + d1] * fd
      const c = filtered[b1 * depthSamples + d0] * (1 - fd) + filtered[b1 * depthSamples + d1] * fd
      const gray = Math.round(a * (1 - fb) + c * fb)
      rgba[offset] = gray
      rgba[offset + 1] = gray
      rgba[offset + 2] = gray
      const id = polarLabels[Math.round(b) * depthSamples + Math.round(d)]
      labelImage[index] = id
      if (id > 2) {
        const entry = structures.get(id) ?? { id, count: 0, x: 0, y: 0 }
        entry.count++
        entry.x += x
        entry.y += y
        structures.set(id, entry)
      }
    }
  return {
    rgba,
    labelImage,
    width,
    height,
    structures: [...structures.values()]
      .filter((s) => s.count >= 8)
      .map((s) => ({ ...s, x: s.x / s.count, y: s.y / s.count })),
    pose,
    controls,
  }
}
