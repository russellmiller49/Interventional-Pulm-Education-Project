import type { LoadedSegmentation } from './loadSegmentation';
import type { SegmentationSegment } from '../../../../../../features/case3d/types';

export type SegmentSelection = Pick<SegmentationSegment, 'labelValue' | 'layer' | 'extent' | 'color' | 'id'>;

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

export function createBinaryMask(
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
