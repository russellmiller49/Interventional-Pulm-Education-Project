import type { DrrLook } from '@fluoroview/volume-drr'
import { ANATOMY } from './anatomy'
import { LESION_CENTER } from './physics'

/**
 * How the course's fluoroscopic image is drawn from its CT.
 *
 * The renderer's own weighting leaves bone barely denser than soft tissue, and on this CT that left
 * the ribs out of the picture altogether: "a posterior rib lies over the nodule" and "three degrees
 * cranial takes it off" could be read in the readout and not seen in the image. Bone is weighted
 * here so that the ribs, the spine, the scapulae and the clavicles the CT resolves are resolved in
 * the projection, at about the contrast a fluoroscopic chest shows them. The weighting stops short
 * of what would bury the cardiac silhouette: "the heart is off the nodule" has to be as readable as
 * "a rib is over it".
 *
 * `boneLowHu` sits below the threshold the "Anatomy over the nodule" readout calls bone
 * (`STRUCTURE_RULES.boneHu`), so whatever the readout names is drawn.
 *
 * Authored display values for this CT. They are not a calibration of any detector or of exposure.
 */
export const FLUORO_LOOK: Pick<
  DrrLook,
  'boneMu' | 'boneLowHu' | 'boneHighHu' | 'toneHigh' | 'toneGamma'
> = {
  boneMu: 0.00078,
  boneLowHu: 100,
  boneHighHu: 620,
  toneHigh: 0.98,
  toneGamma: 0.93,
}

/**
 * Bone depth colouring is measured from the nodule: bone the beam crosses before it (the tube side,
 * posterior in a frontal view) against bone it crosses after (the detector side, anterior).
 */
export const BONE_DEPTH_SPLIT = LESION_CENTER

const smoothstep = (low: number, high: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

/**
 * Each voxel's share of bone, 0–255, on the CT's own grid, smoothed by one voxel in every direction.
 *
 * The ramp from `boneLowHu` to `boneHighHu` is applied to the CT's voxels here rather than to each
 * sample along a ray. A rib is a few voxels thick and crosses the grid obliquely; ramping an
 * interpolated sample draws it as a row of steps, and smoothing the share itself does not.
 */
export function boneShareVolume(volume: Uint8Array): Uint8Array {
  const [sx, sy, sz] = ANATOMY.sizeXyz
  const [huLow, huHigh] = ANATOMY.huRange
  const ramp = new Float32Array(256)
  for (let value = 0; value < 256; value++)
    ramp[value] = smoothstep(
      FLUORO_LOOK.boneLowHu,
      FLUORO_LOOK.boneHighHu,
      huLow + (value / 255) * (huHigh - huLow),
    )
  let share = new Float32Array(volume.length)
  for (let n = 0; n < volume.length; n++) share[n] = ramp[volume[n]]
  // A separable 1-2-1 kernel along x, then y, then z; edges repeat their own value.
  for (const [stride, count] of [
    [1, sx],
    [sx, sy],
    [sx * sy, sz],
  ] as const) {
    const next = new Float32Array(share.length)
    for (let n = 0; n < share.length; n++) {
      const position = Math.floor(n / stride) % count
      const before = position > 0 ? share[n - stride] : share[n]
      const after = position < count - 1 ? share[n + stride] : share[n]
      next[n] = 0.25 * before + 0.5 * share[n] + 0.25 * after
    }
    share = next
  }
  const bytes = new Uint8Array(share.length)
  for (let n = 0; n < share.length; n++) bytes[n] = Math.round(share[n] * 255)
  return bytes
}
