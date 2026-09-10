import {
  frameIndexToContinuousAxisIndex,
  getPlanePoseAtAxisIndex,
  normalizeSliceCrop,
  projectWorldPointToPlaneUv,
} from './patient-space';
import type { CasePlane, EnrichedCaseManifest, Vector3Tuple } from './types';

const DEFAULT_COVERAGE_ASSUMPTION: [number, number] = [0, 1];

function clampUnit(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeCoverageAssumption(coverageAssumption?: [number, number]) {
  if (
    !coverageAssumption ||
    coverageAssumption.length !== 2 ||
    coverageAssumption.some((value) => !Number.isFinite(value))
  ) {
    return DEFAULT_COVERAGE_ASSUMPTION;
  }

  const [start, end] = coverageAssumption;

  if (start === end) {
    return DEFAULT_COVERAGE_ASSUMPTION;
  }

  return [start, end] as [number, number];
}

export function projectNormalizedToSeriesPosition(normalizedPosition: number, coverageAssumption?: [number, number]) {
  const clampedNormalized = clampUnit(normalizedPosition);
  const [start, end] = normalizeCoverageAssumption(coverageAssumption);

  return clampUnit((clampedNormalized - start) / (end - start));
}

export function mapNormalizedToFrameIndex(
  normalizedPosition: number,
  frameCount: number,
  coverageAssumption?: [number, number],
) {
  if (frameCount <= 1) {
    return 0;
  }

  return Math.round(projectNormalizedToSeriesPosition(normalizedPosition, coverageAssumption) * (frameCount - 1));
}

export function projectWorldPointToSliceUv({
  frameIndex,
  manifest,
  plane,
  worldPoint,
}: {
  frameIndex: number;
  manifest: EnrichedCaseManifest;
  plane: CasePlane;
  worldPoint: Vector3Tuple;
}) {
  const axisLengthByPlane = {
    axial: manifest.volumeGeometry.sizes[2],
    coronal: manifest.volumeGeometry.sizes[1],
    sagittal: manifest.volumeGeometry.sizes[0],
  } as const;
  const continuousAxisIndex = frameIndexToContinuousAxisIndex(
    frameIndex,
    manifest.sliceAssetCounts[plane],
    axisLengthByPlane[plane],
    manifest.sliceSeries[plane].coverageAssumption,
  );
  const planePose = getPlanePoseAtAxisIndex(manifest.volumeGeometry, plane, continuousAxisIndex);
  const baseUv = projectWorldPointToPlaneUv(worldPoint, planePose);
  const crop = normalizeSliceCrop(manifest.sliceTextureMetadata[plane].crop);

  return {
    x: crop.x + baseUv.u * crop.width,
    y: crop.y + baseUv.v * crop.height,
  };
}
