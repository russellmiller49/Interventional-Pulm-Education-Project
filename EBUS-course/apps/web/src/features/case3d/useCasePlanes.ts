import { useMemo } from 'react';

import {
  axisNameToIndex,
  getPlanePoseAtAxisIndex,
  projectWorldPointToPlaneUv,
} from '../../../../../features/case3d/patient-space';

import type { CasePlane, RuntimeCaseManifest, SliceIndex, Vector3Tuple } from '../../../../../features/case3d/types';

export function useCasePlanes(
  manifest: RuntimeCaseManifest,
  crosshairVoxel: Vector3Tuple,
  crosshairWorld: Vector3Tuple,
) {
  return useMemo(() => {
    const planeIndices: SliceIndex = {
      axial: Math.round(crosshairVoxel[axisNameToIndex(manifest.volumeGeometry.axisMap.axial)]),
      coronal: Math.round(crosshairVoxel[axisNameToIndex(manifest.volumeGeometry.axisMap.coronal)]),
      sagittal: Math.round(crosshairVoxel[axisNameToIndex(manifest.volumeGeometry.axisMap.sagittal)]),
    };

    const crosshairUv = (['axial', 'coronal', 'sagittal'] as CasePlane[]).reduce(
      (entries, plane) => {
        const pose = getPlanePoseAtAxisIndex(manifest.volumeGeometry, plane, planeIndices[plane]);
        entries[plane] = projectWorldPointToPlaneUv(crosshairWorld, pose);
        return entries;
      },
      {} as Record<CasePlane, { u: number; v: number }>,
    );

    return {
      planeIndices,
      crosshairUv,
    };
  }, [crosshairVoxel, crosshairWorld, manifest]);
}
