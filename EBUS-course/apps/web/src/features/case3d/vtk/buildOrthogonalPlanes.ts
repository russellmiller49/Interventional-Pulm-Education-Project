import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import type vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';

import { planeToSlicingMode } from './coordinateTransforms';
import { resolveMediastinalWindowing } from './ctWindowing';

import type { CasePlane, RuntimeCaseManifest } from '../../../../../../features/case3d/types';

export function createOrthogonalPlaneActor(
  image: vtkImageData,
  manifest: RuntimeCaseManifest,
  plane: CasePlane,
  scalarRange: readonly [number, number],
) {
  const slicingMode = planeToSlicingMode(manifest.volumeGeometry, plane);
  const mapper = vtkImageMapper.newInstance();
  mapper.setInputData(image);
  mapper.setSlicingMode(slicingMode);

  const actor = vtkImageSlice.newInstance();
  actor.setMapper(mapper);

  const { colorWindow, colorLevel } = resolveMediastinalWindowing(scalarRange);
  actor.getProperty().setColorWindow(colorWindow);
  actor.getProperty().setColorLevel(colorLevel);
  actor.getProperty().setInterpolationTypeToLinear();

  return { actor, mapper };
}
