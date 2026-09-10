import { convertItkToVtkImage } from '@kitware/vtk.js/Common/DataModel/ITKHelper';
import type vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import { readImage } from '@itk-wasm/image-io';

import type { Vector3Tuple } from '../../../../../../features/case3d/types';
import { configureImageIo } from './configureImageIo';

async function fetchBinaryFile(url: string, fileName: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to fetch ${fileName}: ${response.status} ${response.statusText}`);
  }

  return {
    path: fileName,
    data: new Uint8Array(await response.arrayBuffer()),
  };
}

export interface LoadedSegmentation {
  image: vtkImageData;
  scalarData: Uint8Array;
  dimensions: Vector3Tuple;
  componentCount: number;
}

export async function loadSegmentation(url: string, fileName = 'case_001_segmentation.nrrd'): Promise<LoadedSegmentation> {
  configureImageIo();
  const binaryFile = await fetchBinaryFile(url, fileName);
  const result = await readImage(binaryFile, { webWorker: false });
  const image = convertItkToVtkImage(result.image, {
    scalarArrayName: 'Segmentation Scalars',
  });

  if (!image) {
    throw new Error(`Unable to convert ${fileName} into vtkImageData.`);
  }

  const scalarData = image.getPointData().getScalars()?.getData();

  if (!(scalarData instanceof Uint8Array)) {
    throw new Error(`Expected ${fileName} to decode into a Uint8Array labelmap.`);
  }

  return {
    image,
    scalarData,
    dimensions: image.getDimensions() as Vector3Tuple,
    componentCount: image.getPointData().getScalars()?.getNumberOfComponents() ?? 1,
  };
}
