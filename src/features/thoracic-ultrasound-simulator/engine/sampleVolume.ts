import type { ThoracicStructureLabel, ThoracicVolume, Vec3, VolumeGeometry } from '../types'

export function worldToVoxel(geometry: VolumeGeometry, world: Vec3): Vec3 {
  const { originLpsMm, spacingXyzMm } = geometry
  return [
    (world[0] - originLpsMm[0]) / spacingXyzMm[0],
    (world[1] - originLpsMm[1]) / spacingXyzMm[1],
    (world[2] - originLpsMm[2]) / spacingXyzMm[2],
  ]
}

export function voxelToWorld(geometry: VolumeGeometry, voxel: Vec3): Vec3 {
  const { originLpsMm, spacingXyzMm } = geometry
  return [
    originLpsMm[0] + voxel[0] * spacingXyzMm[0],
    originLpsMm[1] + voxel[1] * spacingXyzMm[1],
    originLpsMm[2] + voxel[2] * spacingXyzMm[2],
  ]
}

export function containsWorldPoint(volume: ThoracicVolume, world: Vec3) {
  const voxel = worldToVoxel(volume.geometry, world)
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

/**
 * Nearest-neighbour code lookup at a world point. Returns -1 when the point is
 * outside the volume so callers can distinguish "out of bounds" from label 0.
 */
export function sampleCode(volume: ThoracicVolume, world: Vec3): number {
  const voxel = worldToVoxel(volume.geometry, world)
  const [sizeX, sizeY, sizeZ] = volume.geometry.sizeXyz
  const x = Math.round(voxel[0])
  const y = Math.round(voxel[1])
  const z = Math.round(voxel[2])

  if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) {
    return -1
  }

  const index = x + sizeX * (y + sizeY * z)
  return volume.data[index] ?? 0
}

export function sampleLabel(volume: ThoracicVolume, world: Vec3): ThoracicStructureLabel {
  const code = sampleCode(volume, world)
  if (code < 0) {
    return 'background'
  }
  return volume.resolveLabel(code)
}

export function volumeBounds(volume: ThoracicVolume) {
  const [sizeX, sizeY, sizeZ] = volume.geometry.sizeXyz
  return {
    min: voxelToWorld(volume.geometry, [0, 0, 0]),
    max: voxelToWorld(volume.geometry, [sizeX - 1, sizeY - 1, sizeZ - 1]),
  }
}
