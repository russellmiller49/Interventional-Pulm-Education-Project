import { convertItkToVtkImage } from '@kitware/vtk.js/Common/DataModel/ITKHelper';
import type vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import { readImage } from '@itk-wasm/image-io';

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

export interface LoadedCaseVolume {
  image: vtkImageData;
  scalarRange: [number, number];
}

export async function loadCaseVolume(url: string, fileName = 'case_001_ct.nrrd'): Promise<LoadedCaseVolume> {
  configureImageIo();
  const binaryFile = await fetchBinaryFile(url, fileName);
  const result = await readImage(binaryFile, { webWorker: false });
  const image = convertItkToVtkImage(result.image, {
    scalarArrayName: 'CT Scalars',
  });

  if (!image) {
    throw new Error(`Unable to convert ${fileName} into vtkImageData.`);
  }

  const range = image.getPointData().getScalars()?.getRange() ?? [0, 1];

  // CT data stored as int16 often includes padding voxels at -32768 or similar
  // extremes, which makes the raw range far too wide for useful display.
  // Clamp to the standard HU range so windowing produces visible contrast.
  const clampedMin = Math.max(range[0], -1024);
  const clampedMax = Math.min(range[1], 3071);

  return {
    image,
    scalarRange: [clampedMin, clampedMax],
  };
}
