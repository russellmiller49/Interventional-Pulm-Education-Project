import type { ThoracicVolume } from '@/features/thoracic-ultrasound-simulator/types'
import {
  containsWorldPoint as thoracicContainsWorldPoint,
  sampleLabel as thoracicSampleLabel,
  volumeBounds as thoracicVolumeBounds,
  voxelToWorld as thoracicVoxelToWorld,
  worldToVoxel as thoracicWorldToVoxel,
} from '@/features/thoracic-ultrasound-simulator/engine/sampleVolume'

import type { PleuralTissueLabel, PleuralVolume, Vec3 } from '../types'
import { codeToLabel } from './labels'

const thoracicVolumeCache = new WeakMap<PleuralVolume, ThoracicVolume>()

/**
 * View a pleural volume through the shared engine's runtime volume interface.
 * The pleural label codes are fixed, so the resolver is the static code table.
 */
export function toThoracicVolume(volume: PleuralVolume): ThoracicVolume {
  let converted = thoracicVolumeCache.get(volume)
  if (!converted) {
    converted = {
      data: volume.data,
      geometry: volume.geometry,
      resolveLabel: codeToLabel,
    }
    thoracicVolumeCache.set(volume, converted)
  }
  return converted
}

export function worldToVoxel(volume: PleuralVolume, world: Vec3): Vec3 {
  return thoracicWorldToVoxel(volume.geometry, world)
}

export function voxelToWorld(volume: PleuralVolume, voxel: Vec3): Vec3 {
  return thoracicVoxelToWorld(volume.geometry, voxel)
}

export function containsWorldPoint(volume: PleuralVolume, world: Vec3) {
  return thoracicContainsWorldPoint(toThoracicVolume(volume), world)
}

export function sampleLabel(volume: PleuralVolume, world: Vec3): PleuralTissueLabel {
  return thoracicSampleLabel(toThoracicVolume(volume), world) as PleuralTissueLabel
}

export function volumeBounds(volume: PleuralVolume) {
  return thoracicVolumeBounds(toThoracicVolume(volume))
}
