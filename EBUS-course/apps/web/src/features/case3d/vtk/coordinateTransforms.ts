import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';

import {
  addVectors,
  axisNameToIndex,
  crossVectors,
  getPlaneAxes,
  normalizeVector,
  scaleVector,
  voxelToWorld,
  worldToContinuousVoxel,
} from '../../../../../../features/case3d/patient-space';

import type {
  AxisName,
  CasePlane,
  RuntimeCaseManifest,
  Vector3Tuple,
  VolumeGeometry,
  WorldBounds,
} from '../../../../../../features/case3d/types';

export function clampAxisIndex(value: number, size: number) {
  return Math.max(0, Math.min(size - 1, value));
}

export function rowMajorToColumnMajor(matrix: readonly number[]) {
  return new Float32Array([
    matrix[0], matrix[4], matrix[8], matrix[12] ?? 0,
    matrix[1], matrix[5], matrix[9], matrix[13] ?? 0,
    matrix[2], matrix[6], matrix[10], matrix[14] ?? 0,
    matrix[3], matrix[7], matrix[11], matrix[15] ?? 1,
  ]);
}

export function axisNameToSlicingMode(axisName: AxisName) {
  switch (axisName) {
    case 'i':
      return vtkImageMapper.SlicingMode.I;
    case 'j':
      return vtkImageMapper.SlicingMode.J;
    case 'k':
      return vtkImageMapper.SlicingMode.K;
    default:
      return vtkImageMapper.SlicingMode.K;
  }
}

export function planeToSlicingMode(geometry: VolumeGeometry, plane: CasePlane) {
  return axisNameToSlicingMode(getPlaneAxes(geometry.axisMap, plane).normalAxis);
}

export function getPlaneCenterWorld(geometry: VolumeGeometry, plane: CasePlane, axisIndex: number): Vector3Tuple {
  const axes = getPlaneAxes(geometry.axisMap, plane);

  return voxelToWorld(
    [
      axes.normalAxis === 'i' ? axisIndex : (geometry.sizes[0] - 1) / 2,
      axes.normalAxis === 'j' ? axisIndex : (geometry.sizes[1] - 1) / 2,
      axes.normalAxis === 'k' ? axisIndex : (geometry.sizes[2] - 1) / 2,
    ],
    geometry,
  );
}

export function getPlaneNormalWorld(geometry: VolumeGeometry, plane: CasePlane): Vector3Tuple {
  const axes = getPlaneAxes(geometry.axisMap, plane);

  return normalizeVector(geometry.spaceDirections[axisNameToIndex(axes.normalAxis)]);
}

export function getPlaneBasisWorld(geometry: VolumeGeometry, plane: CasePlane) {
  const axes = getPlaneAxes(geometry.axisMap, plane);
  const u = normalizeVector(geometry.spaceDirections[axisNameToIndex(axes.uAxis)]);
  const v = normalizeVector(geometry.spaceDirections[axisNameToIndex(axes.vAxis)]);
  const normal = normalizeVector(crossVectors(u, v));

  return { u, v, normal };
}

export function getCrosshairWorld(manifest: RuntimeCaseManifest, continuousVoxel: Vector3Tuple) {
  return voxelToWorld(continuousVoxel, manifest.volumeGeometry);
}

export function getCrosshairContinuousVoxel(manifest: RuntimeCaseManifest, world: Vector3Tuple) {
  return worldToContinuousVoxel(world, manifest.volumeGeometry);
}

export function boundsToExtent(bounds: WorldBounds) {
  return [bounds.min[0], bounds.max[0], bounds.min[1], bounds.max[1], bounds.min[2], bounds.max[2]] as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export function getBoundsCenter(bounds: WorldBounds): Vector3Tuple {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

export function getBoundsRadius(bounds: WorldBounds) {
  const center = getBoundsCenter(bounds);

  return Math.max(
    1,
    Math.hypot(bounds.max[0] - center[0], bounds.max[1] - center[1], bounds.max[2] - center[2]),
  );
}

export function getPlaneCameraPosition(center: Vector3Tuple, normal: Vector3Tuple, distance: number) {
  return addVectors(center, scaleVector(normal, distance));
}

export function getPlaneCameraDistanceSign(plane: CasePlane) {
  return plane === 'coronal' ? 1 : -1;
}

export function getPlaneViewUp(geometry: VolumeGeometry, plane: CasePlane) {
  const { v } = getPlaneBasisWorld(geometry, plane);

  return v;
}
