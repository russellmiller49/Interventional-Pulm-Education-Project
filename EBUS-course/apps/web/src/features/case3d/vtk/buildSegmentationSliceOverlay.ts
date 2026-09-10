import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkImageResliceMapper from '@kitware/vtk.js/Rendering/Core/ImageResliceMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';

import { createBinaryMask, type SegmentSelection } from './buildSegmentationMask';

import type { LoadedSegmentation } from './loadSegmentation';
import type { Vector3Tuple } from '../../../../../../features/case3d/types';

export function createSegmentationSliceOverlay(
  segmentation: LoadedSegmentation,
  segments: SegmentSelection[],
  color: [number, number, number],
  opacity: number,
  origin: Vector3Tuple,
  normal: Vector3Tuple,
) {
  if (segments.length === 0) {
    return null;
  }

  const { extent, size, mask } = createBinaryMask(segmentation, segments);
  const image = vtkImageData.newInstance();
  const worldOriginVector = segmentation.image.indexToWorld([extent[0], extent[2], extent[4]]);
  const worldOrigin: Vector3Tuple = [worldOriginVector[0], worldOriginVector[1], worldOriginVector[2]];

  image.setDimensions(size[0], size[1], size[2]);
  image.setOrigin(worldOrigin);
  image.setSpacing(segmentation.image.getSpacing());
  image.setDirection(segmentation.image.getDirection());
  image.getPointData().setScalars(
    vtkDataArray.newInstance({
      name: 'Segmentation Slice Mask',
      values: mask,
      numberOfComponents: 1,
    }),
  );

  const plane = vtkPlane.newInstance({
    origin,
    normal,
  });
  const mapper = vtkImageResliceMapper.newInstance();
  mapper.setInputData(image);
  mapper.setSlicePlane(plane);

  const colorTransfer = vtkColorTransferFunction.newInstance();
  colorTransfer.addRGBPoint(0, 0, 0, 0);
  colorTransfer.addRGBPoint(255, color[0], color[1], color[2]);

  const opacityTransfer = vtkPiecewiseFunction.newInstance();
  opacityTransfer.addPoint(0, 0);
  opacityTransfer.addPoint(255, opacity);

  const actor = vtkImageSlice.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().setRGBTransferFunction(0, colorTransfer);
  actor.getProperty().setPiecewiseFunction(0, opacityTransfer);
  actor.getProperty().setInterpolationTypeToNearest();
  actor.getProperty().setOpacity(1);

  return {
    actor,
    colorTransfer,
    image,
    mapper,
    opacityTransfer,
    plane,
  };
}
