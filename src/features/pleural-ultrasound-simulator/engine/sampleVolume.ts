import type { PleuralTissueLabel, PleuralVolume, Vec3 } from '../types'
import { codeToLabel } from './labels'

export function worldToVoxel(volume: PleuralVolume, world: Vec3): Vec3 {
  const { originLpsMm, spacingXyzMm } = volume.geometry
  return [
    (world[0] - originLpsMm[0]) / spacingXyzMm[0],
    (world[1] - originLpsMm[1]) / spacingXyzMm[1],
    (world[2] - originLpsMm[2]) / spacingXyzMm[2],
  ]
}

export function voxelToWorld(volume: PleuralVolume, voxel: Vec3): Vec3 {
  const { originLpsMm, spacingXyzMm } = volume.geometry
  return [
    originLpsMm[0] + voxel[0] * spacingXyzMm[0],
    originLpsMm[1] + voxel[1] * spacingXyzMm[1],
    originLpsMm[2] + voxel[2] * spacingXyzMm[2],
  ]
}

export function containsWorldPoint(volume: PleuralVolume, world: Vec3) {
  const voxel = worldToVoxel(volume, world)
  const [sizeX, sizeY, sizeZ] = volume.geometry.sizeXyz
  return (
    voxel[0] >= 0 &&
    voxel[1] >= 0 &&
    voxel[2] >= 0 &&
    voxel[0] < sizeX &&
    voxel[1] < sizeY &&
    voxel[2] < sizeZ
  )
}

export function sampleLabel(volume: PleuralVolume, world: Vec3): PleuralTissueLabel {
  const voxel = worldToVoxel(volume, world)
  const [sizeX, sizeY, sizeZ] = volume.geometry.sizeXyz
  const x = Math.round(voxel[0])
  const y = Math.round(voxel[1])
  const z = Math.round(voxel[2])

  if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) {
    return 'background'
  }

  const index = x + sizeX * (y + sizeY * z)
  return codeToLabel(volume.data[index] ?? 0)
}

export function volumeBounds(volume: PleuralVolume) {
  const [sizeX, sizeY, sizeZ] = volume.geometry.sizeXyz
  return {
    min: voxelToWorld(volume, [0, 0, 0]),
    max: voxelToWorld(volume, [sizeX - 1, sizeY - 1, sizeZ - 1]),
  }
}
