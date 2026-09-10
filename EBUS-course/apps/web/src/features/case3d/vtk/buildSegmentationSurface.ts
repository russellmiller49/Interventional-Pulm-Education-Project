import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkMatrixBuilder from '@kitware/vtk.js/Common/Core/MatrixBuilder';
import type vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';

import { rowMajorToColumnMajor } from './coordinateTransforms';

import type { LoadedSegmentation } from './loadSegmentation';
import type {
  RuntimeCaseManifest,
  SegmentationSegment,
} from '../../../../../../features/case3d/types';

type SegmentSelection = Pick<SegmentationSegment, 'labelValue' | 'layer' | 'extent' | 'color'>;

function buildUnionExtent(segments: SegmentSelection[]) {
  return segments.reduce<[number, number, number, number, number, number]>(
    (extent, segment) => [
      Math.min(extent[0], segment.extent[0]),
      Math.max(extent[1], segment.extent[1]),
      Math.min(extent[2], segment.extent[2]),
      Math.max(extent[3], segment.extent[3]),
      Math.min(extent[4], segment.extent[4]),
      Math.max(extent[5], segment.extent[5]),
    ],
    [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ],
  );
}

function createBinaryMask(
  segmentation: LoadedSegmentation,
  segments: SegmentSelection[],
) {
  const extent = buildUnionExtent(segments);
  const sizeI = extent[1] - extent[0] + 1;
  const sizeJ = extent[3] - extent[2] + 1;
  const sizeK = extent[5] - extent[4] + 1;
  const mask = new Uint8Array(sizeI * sizeJ * sizeK);
  const labelsByLayer = new Map<number, Set<number>>();

  segments.forEach((segment) => {
    const labels = labelsByLayer.get(segment.layer) ?? new Set<number>();
    labels.add(segment.labelValue);
    labelsByLayer.set(segment.layer, labels);
  });

  const [dimI, dimJ] = segmentation.dimensions;
  const componentCount = segmentation.componentCount;
  let outputIndex = 0;

  for (let k = extent[4]; k <= extent[5]; k += 1) {
    for (let j = extent[2]; j <= extent[3]; j += 1) {
      for (let i = extent[0]; i <= extent[1]; i += 1) {
        const pointIndex = (k * dimJ + j) * dimI + i;
        const scalarOffset = pointIndex * componentCount;
        let filled = false;

        labelsByLayer.forEach((labels, layer) => {
          if (filled) {
            return;
          }

          if (labels.has(segmentation.scalarData[scalarOffset + layer])) {
            filled = true;
          }
        });

        mask[outputIndex] = filled ? 255 : 0;
        outputIndex += 1;
      }
    }
  }

  return {
    extent,
    size: [sizeI, sizeJ, sizeK] as [number, number, number],
    mask,
  };
}

export function createSegmentationSurfaceActor(
  manifest: RuntimeCaseManifest,
  segmentation: LoadedSegmentation,
  segments: SegmentSelection[],
  color: [number, number, number],
  opacity: number,
  clippingPlanes?: vtkPlane | vtkPlane[],
) {
  if (segments.length === 0) {
    return null;
  }

  const { extent, size, mask } = createBinaryMask(segmentation, segments);
  const image = vtkImageData.newInstance({
    origin: [extent[0], extent[2], extent[4]],
    spacing: [1, 1, 1],
  });
  image.setDimensions(size[0], size[1], size[2]);
  image.getPointData().setScalars(
    vtkDataArray.newInstance({
      name: 'Mask',
      values: mask,
      numberOfComponents: 1,
    }),
  );

  const marchingCubes = vtkImageMarchingCubes.newInstance({
    contourValue: 128,
    computeNormals: true,
    mergePoints: true,
  });
  marchingCubes.setInputData(image);
  marchingCubes.update();
  const polyData = marchingCubes.getOutputData();
  const points = polyData.getPoints()?.getData();

  if (!points) {
    return null;
  }

  vtkMatrixBuilder.buildFromRadian()
    .setMatrix(rowMajorToColumnMajor(manifest.segmentation.ijkToWorldMatrix))
    .apply(points);
  polyData.getPoints().modified();

  const mapper = vtkMapper.newInstance();
  mapper.setInputData(polyData);

  if (clippingPlanes) {
    const planes = Array.isArray(clippingPlanes) ? clippingPlanes : [clippingPlanes];
    planes.forEach((plane) => mapper.addClippingPlane(plane));
  }

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().setColor(color[0], color[1], color[2]);
  actor.getProperty().setOpacity(opacity);

  return { actor, mapper, polyData };
}
