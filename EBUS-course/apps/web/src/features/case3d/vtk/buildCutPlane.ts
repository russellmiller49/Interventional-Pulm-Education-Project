import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkImageResliceMapper from '@kitware/vtk.js/Rendering/Core/ImageResliceMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import type vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';

import { resolveMediastinalWindowing } from './ctWindowing';

import type { Vector3Tuple } from '../../../../../../features/case3d/types';

export function createCutPlaneSlice(
  image: vtkImageData,
  scalarRange: readonly [number, number],
  origin: Vector3Tuple,
  normal: Vector3Tuple,
) {
  const plane = vtkPlane.newInstance({
    origin,
    normal,
  });
  const mapper = vtkImageResliceMapper.newInstance();
  mapper.setInputData(image);
  mapper.setSlicePlane(plane);

  const actor = vtkImageSlice.newInstance();
  actor.setMapper(mapper);

  const { colorWindow, colorLevel } = resolveMediastinalWindowing(scalarRange);
  actor.getProperty().setColorWindow(colorWindow);
  actor.getProperty().setColorLevel(colorLevel);
  actor.getProperty().setInterpolationTypeToLinear();

  return { actor, mapper, plane };
}
